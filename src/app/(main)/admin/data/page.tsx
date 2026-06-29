"use client";

import { useEffect, useState } from "react";
import { getDocs } from "firebase/firestore";
import {
  Database,
  RefreshCw,
  Layers,
  HardDrive,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  membersCollection,
  usersCollection,
  activitiesCollection,
  convertsCollection,
  futureMembersCollection,
  birthdaysCollection,
  servicesCollection,
  ministeringCollection,
  ministeringDistrictsCollection,
  annotationsCollection,
  notificationsCollection,
  pushSubscriptionsCollection,
  familySearchTrainingsCollection,
  familySearchTasksCollection,
  missionaryAssignmentsCollection,
  investigatorsCollection,
  healthConcernsCollection,
  baptismsCollection,
  annualReportsCollection,
  newConvertFriendsCollection,
  missionaryImagesCollection,
  familySearchAnnotationsCollection,
  ministeringHistoryCollection,
} from "@/lib/collections";
import { useToast } from "@/hooks/use-toast";
import logger from "@/lib/logger";

interface CollectionInfo {
  name: string;
  label: string;
  count: number | null;
  size: "small" | "medium" | "large";
}

const COLLECTION_DEFS: { name: keyof typeof COLLECTION_REFS_MAP | "c_admin_audit"; label: string; size: "small" | "medium" | "large" }[] = [
  { name: "c_miembros", label: "Miembros", size: "large" },
  { name: "c_users", label: "Usuarios", size: "small" },
  { name: "c_actividades", label: "Actividades", size: "medium" },
  { name: "c_conversos", label: "Conversos", size: "medium" },
  { name: "c_futuros_miembros", label: "Futuros miembros", size: "small" },
  { name: "c_bautismos", label: "Bautismos", size: "small" },
  { name: "c_cumpleanos", label: "Cumpleaños", size: "medium" },
  { name: "c_servicios", label: "Servicios", size: "medium" },
  { name: "c_ministracion", label: "Ministración", size: "medium" },
  { name: "c_ministracion_distritos", label: "Distritos de ministración", size: "small" },
  { name: "c_ministracion_historial", label: "Historial de ministración", size: "medium" },
  { name: "c_anotaciones", label: "Anotaciones", size: "large" },
  { name: "c_notifications", label: "Notificaciones", size: "medium" },
  { name: "c_push_subscriptions", label: "Suscripciones push", size: "small" },
  { name: "c_fs_capacitaciones", label: "Capacitaciones FamilySearch", size: "small" },
  { name: "c_fs_pendientes", label: "Tareas FamilySearch", size: "medium" },
  { name: "c_fs_anotaciones", label: "Anotaciones FamilySearch", size: "small" },
  { name: "c_obra_misional_asignaciones", label: "Asignaciones misionales", size: "medium" },
  { name: "c_obra_misional_investigadores", label: "Investigadores", size: "medium" },
  { name: "c_obra_misional_amigos_conversos", label: "Amigos conversos", size: "small" },
  { name: "c_obra_misional_imagenes", label: "Imágenes misionales", size: "small" },
  { name: "c_observaciones_salud", label: "Observaciones de salud", size: "small" },
  { name: "c_reporte_anual", label: "Reporte anual", size: "small" },
  { name: "c_admin_audit", label: "Bitácora administrativa", size: "small" },
];

const COLLECTION_REFS_MAP = {
  c_miembros: membersCollection,
  c_users: usersCollection,
  c_actividades: activitiesCollection,
  c_conversos: convertsCollection,
  c_futuros_miembros: futureMembersCollection,
  c_bautismos: baptismsCollection,
  c_cumpleanos: birthdaysCollection,
  c_servicios: servicesCollection,
  c_ministracion: ministeringCollection,
  c_ministracion_distritos: ministeringDistrictsCollection,
  c_ministracion_historial: ministeringHistoryCollection,
  c_anotaciones: annotationsCollection,
  c_notifications: notificationsCollection,
  c_push_subscriptions: pushSubscriptionsCollection,
  c_fs_capacitaciones: familySearchTrainingsCollection,
  c_fs_pendientes: familySearchTasksCollection,
  c_fs_anotaciones: familySearchAnnotationsCollection,
  c_obra_misional_asignaciones: missionaryAssignmentsCollection,
  c_obra_misional_investigadores: investigatorsCollection,
  c_obra_misional_amigos_conversos: newConvertFriendsCollection,
  c_obra_misional_imagenes: missionaryImagesCollection,
  c_observaciones_salud: healthConcernsCollection,
  c_reporte_anual: annualReportsCollection,
} as const;

function refFor(name: keyof typeof COLLECTION_REFS_MAP) {
  return COLLECTION_REFS_MAP[name];
}

export default function AdminDataPage() {
  const { toast } = useToast();
  const [info, setInfo] = useState<CollectionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    setIsLoading(true);
    const results: CollectionInfo[] = [];
    for (const def of COLLECTION_DEFS) {
      if (def.name === "c_admin_audit") {
        results.push({ ...def, count: null });
        continue;
      }
      const ref = refFor(def.name);
      try {
        const snap = await getDocs(ref);
        results.push({ ...def, count: snap.size });
      } catch (err) {
        logger.warn({
          error: err,
          message: `Could not read ${def.name}`,
        });
        results.push({ ...def, count: null });
      }
    }
    setInfo(results);
    setIsLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalDocs = info.reduce((sum, c) => sum + (c.count ?? 0), 0);

  return (
    <section className="page-section">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" />
          <h1 className="text-balance text-fluid-title font-semibold">
            Datos del sistema
          </h1>
        </div>
        <p className="text-balance text-fluid-subtitle text-muted-foreground">
          Estado de las colecciones de Firestore. Útil para diagnósticos y mantenimiento.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <HardDrive className="h-8 w-8 text-primary" />
            <div>
              <div className="text-2xl font-bold">{totalDocs.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Documentos totales</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Layers className="h-8 w-8 text-primary" />
            <div>
              <div className="text-2xl font-bold">{COLLECTION_DEFS.length}</div>
              <p className="text-xs text-muted-foreground">Colecciones activas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Button onClick={load} disabled={isLoading} className="w-full">
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Colecciones</CardTitle>
          <CardDescription>
            Recuento de documentos en cada colección. Las marcadas con error no se pudieron leer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && info.length === 0 ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {info.map((c) => (
                <div
                  key={c.name}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.count === null ? (
                      <Badge variant="destructive">Error</Badge>
                    ) : (
                      <Badge variant="secondary" className="font-mono">
                        {c.count.toLocaleString()}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
