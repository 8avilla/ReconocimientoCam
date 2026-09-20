SUPER TORNEOS

Documento de contexto, alcance funcional y guía de desarrollo

Versión 1.0 · MVP enfocado en identidad, asistencia y verificación de jugadores

1. Contexto del producto

Super Torneos es una plataforma web Mobile First para administrar campeonatos de fútbol. El problema inicial que se busca resolver es operativo: actualmente la información de los campeonatos se lleva principalmente en cuadernos y archivos Excel. En muchos casos solo se dispone del nombre de los jugadores, sin una identidad digital que permita saber con certeza quién asistió, quién estuvo habilitado para jugar y quién efectivamente se presentó a un partido.

La prioridad del producto no es comenzar con estadísticas avanzadas ni con un sistema completo de administración deportiva. La prioridad es construir una base sólida de identidad de jugadores y un flujo rápido de asistencia y verificación que pueda utilizarse directamente en cancha desde un celular.

2. Visión

Convertir la gestión de torneos de fútbol, actualmente basada en papel y Excel, en una operación digital centralizada, verificable y auditable.

Principio rector: “Una sola experiencia, cualquier dispositivo.”

El sistema debe funcionar especialmente bien en móvil para árbitros, planilleros y delegados, y ofrecer una experiencia más completa en desktop para administradores.

3. Conceptos de negocio

Concepto

Descripción

Super Torneos

Producto/plataforma que permite gestionar múltiples campeonatos.

Campeonato

Torneo concreto, por ejemplo Liga Master, con sus reglas y temporada.

Equipo

Participante del campeonato con escudo, colores, delegado y nómina.

Jugador

Persona inscrita en un equipo, con identidad, foto, documento, número y estado.

Partido

Encuentro entre dos equipos dentro de una fase o jornada.

Convocatoria

Jugadores habilitados/seleccionados por un equipo para un partido.

Check-in

Registro de presencia de un jugador en un partido.

Verificación

Proceso que confirma que la persona presente corresponde al jugador registrado.

Evento de partido

Gol, tarjeta, cambio, autogol u otro evento registrado durante el partido.

4. Roles del sistema

Rol

Responsabilidades principales

Administrador de Super Torneos

Gestiona usuarios y configuración global.

Administrador del campeonato

Gestiona campeonato, equipos, jugadores, calendario, disciplina y reportes.

Delegado de equipo

Administra nómina, jugadores y convocatorias de su equipo.

Árbitro / planillero

Realiza asistencia, verificación, planilla, eventos y cierre del partido.

Jugador

Consulta perfil, carnet, calendario, asistencia y estadísticas propias.

Público

Consulta información pública habilitada.

5. Alcance del MVP

Crear y configurar campeonatos.

Registrar equipos y jugadores a partir de datos existentes de Excel.

Crear identidad digital para cada jugador mediante datos + fotografía + identificador único/QR.

Gestionar convocatorias y asistencia por partido.

Verificar la identidad del jugador mediante QR y preparar la comparación facial 1:1 como siguiente etapa.

6. Funcionalidades a desarrollar

6.1 Gestión de campeonatos

Crear campeonato: nombre, temporada, fechas y estado.

Configurar formato: liga, grupos, eliminatoria o mixto.

Configurar puntos y criterios de desempate.

Configurar número de jugadores, cupo de nómina y mínimo de jugadores para iniciar.

Registrar sedes y canchas.

Estados: borrador, inscripciones abiertas, en curso y finalizado.

Soportar múltiples campeonatos en paralelo.

6.2 Importación inicial desde Excel

Carga de Excel/CSV.

Mapeo de columnas y previsualización.

Validación de duplicados y datos obligatorios.

Detección de jugadores sin documento/foto.

Reporte de errores.

Confirmación de importación.

Lista de pendientes para completar identidad.

6.3 Gestión de equipos

Crear, editar, activar/desactivar equipo.

Nombre, escudo, colores y delegado/capitán.

Consultar nómina, partidos y estadísticas.

Indicadores de jugadores activos, suspendidos y pendientes.

6.4 Registro de jugadores

Nombre completo, documento y fecha de nacimiento.

Posición y número de camiseta.

Equipo y estado.

Fotografía oficial.

Identificador único.

QR para carnet.

Historial de equipos dentro de los campeonatos.

Historial de asistencia y verificaciones.

6.5 Carnet digital

Foto, nombre, equipo, número, posición y estado.

QR asociado a un identificador interno, sin exponer todos los datos personales.

Consulta y presentación desde móvil.

Estado actualizado de habilitación/suspensión.

6.6 Partidos y convocatoria

Crear/programar partido con fecha, hora, cancha y equipos.

Seleccionar jugadores convocados.

Validar automáticamente inscripción y habilitación.

Advertir o impedir convocatorias de jugadores suspendidos.

Mostrar cantidad de convocados.

Modificar convocatoria antes del cierre definido.

6.7 Asistencia por partido — PRIORIDAD MÁXIMA

La asistencia debe estar relacionada con el partido y no simplemente con una fecha.

Mostrar lista de convocados.

Estados: presente, ausente y pendiente.

Registrar fecha y hora del check-in.

Registrar operador.

Buscar por nombre o número.

Escanear QR.

Registrar manualmente como contingencia.

Mostrar resumen de convocados, presentes, ausentes, pendientes y verificados.

Guardar historial por jugador y partido.

Preparar operación offline y sincronización posterior.

6.8 Verificación de jugadores — PRIORIDAD MÁXIMA

Flujo objetivo: Escanear QR → identificar jugador → capturar rostro → validar identidad → confirmar asistencia.

QR identifica al jugador registrado.

Mostrar fotografía oficial y datos básicos.

Capturar imagen en vivo.

Comparar 1:1 contra la fotografía registrada.

Resultado: verificado, no coincide o revisión manual.

Guardar resultado, hora, operador y evidencia permitida por la política de privacidad.

Permitir revisión manual cuando el resultado automático no sea concluyente.

En fase posterior, implementar 1:N para detectar posibles suplantaciones cruzadas.

En fase posterior, implementar liveness.

6.9 Disciplina

Registrar tarjetas amarillas y rojas.

Acumulación automática.

Suspensión automática según reglas.

Suspensiones manuales.

Impedir convocatoria de jugadores suspendidos.

Historial disciplinario.

6.10 Estadísticas y clasificación

Tabla de posiciones.

Goles a favor/en contra y diferencia de gol.

Goleadores y asistencias.

Tarjetas.

Partidos jugados.

Minutos cuando exista información suficiente.

Historial de enfrentamientos y rachas.

6.11 Eventos del partido

Gol, autogol, asistencia, amarilla, roja, cambio, penal e incidente.

Inicio, entretiempo y final.

Los eventos deben alimentar automáticamente estadísticas y disciplina.

6.12 Auditoría

Registrar acciones críticas.

Quién creó/modificó jugador.

Quién cambió convocatoria.

Quién realizó verificación.

Quién modificó resultado.

Quién registró/anuló evento.

Fecha/hora y usuario.

Conservar historial crítico sin sobrescritura.

7. Flujo principal de operación en cancha

Configurar campeonato, equipos y jugadores.

Completar identidad y fotografía de jugadores.

Generar carnet digital con QR.

Crear convocatoria del partido.

Abrir control de asistencia.

Identificar jugador mediante QR o búsqueda.

Validar inscripción y habilitación.

Realizar verificación de identidad.

Registrar check-in.

Revisar excepciones.

Comenzar partido con lista de jugadores habilitados.

Conservar historial de asistencia y verificación asociado al partido.

8. Modelo de datos conceptual

El modelo debe separar la identidad del jugador de su participación/inscripción en un campeonato.

User

Championship

Season

Phase

Group

Team

TeamRegistration

Player

PlayerIdentity

PlayerPhoto

PlayerCard

Venue

Field

Match

MatchCallUp

PlayerCheckIn

IdentityVerification

MatchEvent

DisciplinaryAction

Suspension

Standings

Notification

AuditLog

Relación clave: Championship → Match → Team → Player → CallUp → PlayerCheckIn → IdentityVerification.

9. Reglas de negocio críticas

El jugador tiene un identificador interno único; el nombre no es identificador.

No permitir doble pertenencia simultánea dentro del mismo campeonato salvo transferencia formal.

Jugador suspendido no puede ser convocado normalmente.

La asistencia siempre pertenece a un partido.

La verificación pertenece a jugador + partido.

La verificación no modifica por sí sola los datos maestros.

Acciones críticas auditables.

El QR no expone datos personales sensibles.

Consentimiento, finalidad, seguridad, retención y control de acceso para fotografías y biometría.

10. UI/UX y Design System

Token

Valor / regla

Primary

#16A34A

Primary Dark

#15803D

Primary Light

#DCFCE7

Navy

#0F172A

Background

#F8FAFC

Surface

#FFFFFF

Border

#E2E8F0

Text Primary

#0F172A

Text Secondary

#64748B

Tipografía

Inter

Card radius

12px

Input/Button móvil

44–48px

Mobile navigation

Bottom navigation

Desktop navigation

Sidebar

Diseño

Mobile First

La interfaz debe ser deportiva, moderna, limpia, confiable y operativa. Mobile prioriza velocidad y acciones de cancha; desktop prioriza densidad de información y administración.

11. Arquitectura técnica sugerida

Frontend: Angular + TypeScript, modular y responsive.

Backend: .NET 8 Web API.

Persistencia: SQL Server + Entity Framework Core.

Fotos/documentos: almacenamiento de objetos, por ejemplo Azure Blob Storage.

Tiempo real: SignalR cuando se implemente el registro en vivo.

Autenticación/autorización: JWT/OIDC + RBAC.

PWA/offline: almacenamiento local + cola de sincronización.

API REST con DTOs y contratos claros.

Separar dominio, aplicación, infraestructura y API.

No introducir microservicios prematuramente; un modular monolith es suficiente para el MVP.

12. Seguridad y privacidad

Minimizar datos personales.

No exponer documentos completos en vistas públicas.

No almacenar datos sensibles directamente en el QR.

Controlar acceso a fotografías.

Auditar accesos y acciones críticas.

Cifrar información en tránsito y aplicar controles adecuados en almacenamiento.

Definir retención y eliminación de evidencias.

Antes de reconocimiento facial, implementar consentimiento explícito y las medidas de protección requeridas para datos biométricos.

13. Offline y conectividad

Descargar previamente la información necesaria del partido.

Registrar check-ins localmente.

Marcar registros pendientes de sincronización.

Sincronizar al recuperar conectividad.

Resolver conflictos de manera explícita y auditable.

14. Criterios de aceptación del MVP

Crear campeonato.

Importar nómina desde Excel.

Crear equipos y jugadores.

Asignar fotografía e identificador único.

Generar carnet digital con QR.

Crear partido y convocatoria.

Validar habilitación de jugadores.

Registrar asistencia desde móvil.

Guardar fecha/hora/operador.

Consultar historial de asistencia.

Identificar rápidamente mediante QR.

Preparar integración de verificación facial 1:1.

Auditar acciones críticas.

Mantener el mismo lenguaje visual en móvil, tablet y desktop.

15. Roadmap recomendado

Fase

Objetivo

Funcionalidades

Fase 1 — MVP

Identidad + asistencia

Campeonato, equipos, jugadores, Excel, foto, QR, partidos, convocatorias, asistencia y auditoría.

Fase 2

Verificación

Facial 1:1, revisión manual, liveness y auditoría avanzada.

Fase 3

Competencia

Fixture, fases, grupos, tabla, resultados, eventos, disciplina y estadísticas.

Fase 4

Operación

Offline robusto, notificaciones, WhatsApp y reportes.

Fase 5

Plataforma

Pagos, organizaciones, analítica y funcionalidades comerciales.

16. Instrucciones para el agente de desarrollo

Analizar primero el proyecto y arquitectura existentes antes de crear nuevas capas.

Implementar el MVP por módulos verticales funcionales.

Priorizar el flujo real de cancha.

No duplicar modelos, servicios ni componentes.

Definir dominio y contratos API antes de construir pantallas dependientes.

Separar UI, aplicación y persistencia.

Validar frontend y backend.

Auditar acciones críticas.

Diseñar desde el inicio para múltiples campeonatos.

Separar identidad del jugador de su inscripción/participación.

Preparar reconocimiento facial sin bloquear el MVP.

Cada funcionalidad debe contemplar loading, empty, error, success y permisos.

Probar primero en móvil.

No considerar una funcionalidad terminada hasta cumplir sus criterios de aceptación.

17. Primera entrega que debe producir el agente

Mapa de módulos.

Arquitectura propuesta.

Modelo de dominio.

Diagrama de base de datos.

Endpoints iniciales.

Estructura de carpetas frontend/backend.

Design tokens implementados.

Flujo UX de registro de jugador.

Flujo UX de creación de partido.

Flujo UX de asistencia.

Flujo UX de verificación.

Plan de implementación por iteraciones.

Riesgos técnicos y decisiones pendientes.

18. Resultado esperado

Super Torneos debe reemplazar progresivamente la lista de nombres del cuaderno/Excel por una base de jugadores identificables, verificables y asociados a partidos concretos. La primera victoria del producto es poder responder con trazabilidad: quién estaba convocado, quién asistió, quién fue verificado, cuándo se verificó y quién realizó la operación.

