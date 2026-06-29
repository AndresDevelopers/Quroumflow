"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  UserCog,
  Shield,
  Activity,
  Database,
  ScrollText,
  AlertTriangle,
  Loader2,
  TrendingUp,
  HeartHandshake,
  BookUser,
  Cake,
  Wrench,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { collection, getDocs } from "firebase/firestore";
import {
  usersCollection,
  membersCollection,
  activitiesCollection,
  convertsCollection,
  futureMembersCollection,
  birthdaysCollection,
  servicesCollection,
} from "@/lib/collections";
import { normalizeRole, type UserRole } from "@/lib/roles";
import { Timestamp } from "firebase/firestore";

interface SystemStats {
  totalUsers: number;
  totalMembers: number;
  totalActivities: number;
  totalConverts: number;
  totalFutureMembers: number;
  totalBirthdays: number;
  totalServices: number;
  usersByRole: Record<UserRole, number>;
  recentMembers: number;
}

const ROLE_LABELS: Record<UserRole, string> = {
  user: "Miembro",
  counselor: "Consejero",
  president: "Presidente",
  secretary: "Secretario",
  other: "Otro",
};

const ROLE_COLORS: Record<UserRole, string> = {
  user: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  counselor: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  president: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  secretary: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  other: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

export default function AdminHomePage() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [usersSnap, membersSnap, activitiesSnap, convertsSnap, futureSnap, birthdaysSnap, servicesSnap] = await Promise.all([
          getDocs(usersCollection),
          getDocs(membersCollection),
          getDocs(activitiesCollection),
          getDocs(convertsCollection),
          getDocs(futureMembersCollection),
          getDocs(birthdaysCollection),
          getDocs(servicesCollection),
        ]);

        const usersByRole: Record<UserRole, number> = {
          user: 0,
          counselor: 0,
          president: 0,
          secretary: 0,
          other: 0,
        };

        usersSnap.forEach((d) => {
          const r = normalizeRole(d.data().role);
          usersByRole[r] = (usersByRole[r] || 0) + 1;
        });

        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        let recentMembers = 0;
        membersSnap.forEach((d) => {
          const createdAt = d.data().createdAt as Timestamp | undefined;
          if (createdAt && typeof createdAt.toMillis === "function") {
            if (createdAt.toMillis() >= sevenDaysAgo) recentMembers += 1;
          }
        });

        setStats({
          totalUsers: usersSnap.size,
          totalMembers: membersSnap.size,
          totalActivities: activitiesSnap.size,
          totalConverts: convertsSnap.size,
          totalFutureMembers: futureSnap.size,
          totalBirthdays: birthdaysSnap.size,
          totalServices: servicesSnap.size,
          usersByRole,
          recentMembers,
        });
      } catch (err) {
        console.error("Error loading admin stats", err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  return (
    <section className="page-section">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Shield className="h-7 w-7 text-primary" />
          <h1 className="text-balance text-fluid-title font-semibold">
            Panel de Administración
          </h1>
        </div>
        <p className="text-balance text-fluid-subtitle text-muted-foreground">
          Control total del sistema. Gestiona usuarios, miembros y configuraciones avanzadas.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard
          icon={Users}
          label="Usuarios registrados"
          value={stats?.totalUsers}
          isLoading={isLoading}
          href="/admin/users"
          description="Cuentas con acceso a QuorumFlow"
        />
        <AdminStatCard
          icon={UserCog}
          label="Miembros del quórum"
          value={stats?.totalMembers}
          isLoading={isLoading}
          href="/admin/members"
          description="En la base de datos"
        />
        <AdminStatCard
          icon={TrendingUp}
          label="Nuevos esta semana"
          value={stats?.recentMembers}
          isLoading={isLoading}
          description="Miembros agregados en los últimos 7 días"
        />
        <AdminStatCard
          icon={Activity}
          label="Actividades"
          value={stats?.totalActivities}
          isLoading={isLoading}
          description="Actividades registradas"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard
          icon={HeartHandshake}
          label="Conversos"
          value={stats?.totalConverts}
          isLoading={isLoading}
          description="Conversos recientes"
        />
        <AdminStatCard
          icon={BookUser}
          label="Futuros miembros"
          value={stats?.totalFutureMembers}
          isLoading={isLoading}
          description="En proceso"
        />
        <AdminStatCard
          icon={Cake}
          label="Cumpleaños"
          value={stats?.totalBirthdays}
          isLoading={isLoading}
          description="Registrados"
        />
        <AdminStatCard
          icon={Wrench}
          label="Servicios"
          value={stats?.totalServices}
          isLoading={isLoading}
          description="Proyectos de servicio"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribución de roles</CardTitle>
            <CardDescription>Cuentas activas por nivel de acceso</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : (
              (Object.keys(ROLE_LABELS) as UserRole[]).map((r) => {
                const count = stats?.usersByRole[r] ?? 0;
                const total = stats?.totalUsers ?? 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={r} className="flex items-center gap-3">
                    <Badge className={ROLE_COLORS[r]} variant="secondary">
                      {ROLE_LABELS[r]}
                    </Badge>
                    <div className="flex-1">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-16 text-right text-sm font-medium">
                      {count} ({pct}%)
                    </span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acciones rápidas</CardTitle>
            <CardDescription>Atajos administrativos</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Button asChild variant="outline" className="h-auto justify-start gap-3 py-4">
              <Link href="/admin/users">
                <UserCog className="h-5 w-5 text-primary" />
                <div className="flex flex-col items-start text-left">
                  <span className="font-medium">Gestionar usuarios</span>
                  <span className="text-xs text-muted-foreground">Roles y permisos</span>
                </div>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto justify-start gap-3 py-4">
              <Link href="/admin/members">
                <Users className="h-5 w-5 text-primary" />
                <div className="flex flex-col items-start text-left">
                  <span className="font-medium">Administrar miembros</span>
                  <span className="text-xs text-muted-foreground">Búsqueda y edición global</span>
                </div>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto justify-start gap-3 py-4">
              <Link href="/admin/audit">
                <ScrollText className="h-5 w-5 text-primary" />
                <div className="flex flex-col items-start text-left">
                  <span className="font-medium">Registro de auditoría</span>
                  <span className="text-xs text-muted-foreground">Bitácora del sistema</span>
                </div>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto justify-start gap-3 py-4">
              <Link href="/admin/data">
                <Database className="h-5 w-5 text-primary" />
                <div className="flex flex-col items-start text-left">
                  <span className="font-medium">Datos del sistema</span>
                  <span className="text-xs text-muted-foreground">Mantenimiento</span>
                </div>
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
            <AlertTriangle className="h-5 w-5" />
            Aviso de administrador
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-amber-800 dark:text-amber-200">
          Los cambios realizados aquí afectan a todos los usuarios y datos del sistema.
          Procede con responsabilidad y coordina con la presidencia del quórum antes
          de realizar cambios importantes.
        </CardContent>
      </Card>
    </section>
  );
}

function AdminStatCard({
  icon: Icon,
  label,
  value,
  isLoading,
  href,
  description,
}: {
  icon: typeof Users;
  label: string;
  value: number | undefined;
  isLoading: boolean;
  href?: string;
  description?: string;
}) {
  const content = (
    <Card className={href ? "transition-colors hover:bg-muted/40" : undefined}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-7 w-16" />
        ) : (
          <div className="text-2xl font-bold">{value ?? 0}</div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}
