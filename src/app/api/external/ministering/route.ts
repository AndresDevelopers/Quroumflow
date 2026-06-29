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

async function resolveBarrioOrg(request: NextRequest): Promise<string | NextResponse> {
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
  return `${barrio}|${organizacion}`;
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

async function fetchMinisteringData(barrioOrg: string) {
  const db = await initializeFirebaseForServer();

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

  const companionships = compSnapshot.docs.map(doc => ({
    id: doc.id,
    ...serializeDoc(doc.data()),
  }));

  const districts = distSnapshot.docs.map(doc => ({
    id: doc.id,
    ...serializeDoc(doc.data()),
  }));

  return { companionships, districts };
}

const getCachedMinisteringData = unstable_cache(
  fetchMinisteringData,
  ['external-ministering'],
  { revalidate: 3600, tags: ['external-ministering'] }
);

export async function GET(request: NextRequest) {
  const barrioOrg = await resolveBarrioOrg(request);
  if (barrioOrg instanceof NextResponse) return barrioOrg;

  try {
    if (process.env.NODE_ENV !== 'production') {
      const data = await fetchMinisteringData(barrioOrg);
      const response = NextResponse.json(data);
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      return response;
    }

    const data = await getCachedMinisteringData(barrioOrg);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in /api/external/ministering:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ministering data', details: (error as Error).message },
      { status: 500 }
    );
  }
}
