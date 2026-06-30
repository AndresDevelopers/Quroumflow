import { NextRequest, NextResponse } from 'next/server';
import { getDocs, query, orderBy, where, collection, Timestamp } from 'firebase/firestore';
import { unstable_cache } from 'next/cache';
import { authAdmin, firestoreAdmin } from '@/lib/firebase-admin';
import { normalizeRole } from '@/lib/roles';

function getBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  return authorization.slice('Bearer '.length).trim() || null;
}

interface ResolvedAuth {
  barrioOrg: string;
  userEmail: string | null;
}

async function resolveAuth(request: NextRequest): Promise<ResolvedAuth | NextResponse> {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 });
  }

  let decoded;
  try {
    decoded = await authAdmin.verifyIdToken(token);
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  const userDoc = await firestoreAdmin.collection('c_users').doc(decoded.uid).get();
  if (!userDoc.exists) {
    return NextResponse.json({ error: 'User not found' }, { status: 403 });
  }

  const data = userDoc.data()!;
  const role = normalizeRole(data.role);
  if (!role || role === 'user') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const barrio = data.barrio || 'Libertad';
  const organizacion = data.organizacion || 'Quórum de Élderes';
  const userEmail = decoded.email || null;

  return { barrioOrg: `${barrio}|${organizacion}`, userEmail };
}

async function initializeFirebaseForServer() {
  const { initializeApp, getApps } = await import('firebase/app');
  const { getFirestore } = await import('firebase/firestore');
  const { firebaseConfig } = await import('@/firebaseConfig');
  const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  return getFirestore(app);
}

function serializeDoc(docData: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(docData)) {
    if (value instanceof Timestamp) {
      result[key] = value.toDate().toISOString();
    } else if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => unknown }).toDate === 'function') {
      const date = (value as { toDate: () => Date }).toDate();
      if (date instanceof Date && !isNaN(date.getTime())) {
        result[key] = date.toISOString();
      } else {
        result[key] = value;
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}

async function fetchMinisteringData(barrioOrg: string, userEmail: string | null) {
  const db = await initializeFirebaseForServer();

  // Build a set of member full names that match the user's email
  let memberNames: Set<string> | null = null;
  if (userEmail) {
    const membersSnapshot = await getDocs(query(
      collection(db, 'c_miembros'),
      where('barrioOrg', '==', barrioOrg),
      where('email', '==', userEmail)
    ));
    if (membersSnapshot.size > 0) {
      memberNames = new Set<string>();
      membersSnapshot.docs.forEach(doc => {
        const m = doc.data();
        const fullName = `${m.firstName || ''} ${m.lastName || ''}`.trim();
        if (fullName) memberNames!.add(fullName);
      });
    }
  }

  const [compSnapshot, distSnapshot] = await Promise.all([
    getDocs(query(
      collection(db, 'c_ministracion'),
      where('barrioOrg', '==', barrioOrg),
      orderBy('companions')
    )),
    getDocs(query(
      collection(db, 'c_ministracion_distritos'),
      where('barrioOrg', '==', barrioOrg),
      orderBy('name')
    )),
  ]);

  let companionships = compSnapshot.docs.map(doc => ({
    id: doc.id,
    ...serializeDoc(doc.data()),
  }));

  // Filter by member email if applicable
  if (memberNames && memberNames.size > 0) {
    companionships = companionships.filter((comp: any) => {
      // Check if user is a companion
      const companions: string[] = comp.companions || [];
      if (companions.some(name => memberNames!.has(name))) return true;

      // Check if user is in a family
      const families: any[] = comp.families || [];
      return families.some((f: any) => memberNames!.has(f.name || ''));
    });
  }

  const matchingCompIds = new Set(companionships.map(c => c.id));

  const districts = distSnapshot.docs
    .map(doc => ({
      id: doc.id,
      ...serializeDoc(doc.data()),
    }))
    .filter((dist: any) => {
      if (!memberNames || memberNames.size === 0) return true;
      const ids: string[] = dist.companionshipIds || [];
      return ids.some((id: string) => matchingCompIds.has(id));
    });

  return { companionships, districts };
}

const getCachedMinisteringData = unstable_cache(
  fetchMinisteringData,
  ['external-ministering'],
  { revalidate: 3600, tags: ['external-ministering'] }
);

export async function GET(request: NextRequest) {
  const resolved = await resolveAuth(request);
  if (resolved instanceof NextResponse) return resolved;

  const { barrioOrg, userEmail } = resolved;

  try {
    if (process.env.NODE_ENV !== 'production') {
      const data = await fetchMinisteringData(barrioOrg, userEmail);
      const response = NextResponse.json(data);
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      return response;
    }

    const data = await getCachedMinisteringData(barrioOrg, userEmail);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in /api/external/ministering:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ministering data', details: (error as Error).message },
      { status: 500 }
    );
  }
}
