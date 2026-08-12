# PLATFORM_INPUT_REQUIRED — términos y condiciones

Estado: `PENDING_VALIDATION`. Estos valores no bloquean implementación, pruebas locales
ni validación estática. Sí bloquean promoción y cualquier afirmación de disponibilidad
en producción. Este documento registra únicamente identificadores no sensibles y nombres
de referencias; credenciales, certificados y tokens están prohibidos.

| Entrada requerida | Responsable/canal aprobado | Referencia no sensible esperada | Consumidor |
|---|---|---|---|
| Reconciliador GitOps, repositorio desired-state y rama protegida | ticket de plataforma | URL/ID de repositorio, proyecto y rama | Argo CD/Tekton |
| Namespace, registry y dominio de producción | ticket de plataforma | namespace, hostname y ruta de registry | overlays/Route existente |
| PostgreSQL administrado lógico para `terms` | ticket DBA/plataforma | hostname, puerto, DB, modo TLS y CIDRs; sin password | terms-api y jobs |
| CA y credenciales PostgreSQL | secret manager corporativo | `terms-database-tls`, `terms-runtime`, `terms-migrator`, `terms-retention`, `terms-backup` | mounts proyectados |
| Política, destino y objetivos RPO/RTO de backup/PITR | ticket DBA/continuidad | ID de política y `terms-backup-target` | backup/restore aislado |
| Destino OIDC/JWKS autorizado | ticket IAM/red | issuer, audience, hostname y CIDR de egress | terms-api/terms-web |
| Cliente y roles del IdP | ticket IAM | client ID público y mapeo `terms_admin`, `supervisor`, `auditor` | OIDC/JWT |
| Integración corporativa de monitoreo | ticket observabilidad | namespace/labels de ServiceMonitor y destino de alertas | Prometheus/Alertmanager |

## Criterio de desbloqueo

1. Cada ticket aprobado se enlaza por su identificador, nunca copiando valores secretos.
2. Secretos se sincronizan mediante el secret manager bajo los nombres del contrato en
   `deploy/openshift/base/config/secret-reference-contract.yaml`.
3. El perfil de plataforma se vuelve a descubrir y las redes se renderizan con los CIDR
   autorizados; los rangos TEST-NET deben desaparecer de cualquier overlay promovible.
4. Backup/PITR y restore aislado se ejecutan antes de producción y registran timestamp,
   checksum y resultado redactado.
5. GitOps, rollout, smoke, alertas y rollback deben quedar `CONFIRMED` en la evidencia de
   despliegue. La aplicación directa observada en desarrollo no sustituye reconciliación.

## Estado observado al 2026-08-12

- OpenShift y Pipelines están observados en desarrollo.
- External Secrets aparece disponible en el perfil observado más reciente.
- No hay reconciliador GitOps observado; los registros de release continúan pendientes.
- Producción, PostgreSQL administrado, backup/PITR, CIDR JWKS y monitoreo corporativo no
  tienen todavía referencias de ticket aprobadas en el repositorio.
