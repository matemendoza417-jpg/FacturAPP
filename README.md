# FacturAPP 🚀 - De las plantillas de Excel al SaaS Mobile-First con IA

Toda gran solución nace de un problema real. El **23 de abril de 2026**, este proyecto arrancó por una razón: mi viejo es autónomo y hacía sus facturas a mano en Excel. Yo lo veía renegar y me dije: *"Yo esto lo puedo cambiar"*. No tenía ni la más pálida idea de programación, de código ni de sistemas, pero siempre tuve la ilusión profunda de ser programador.

Le conté todo el problema a la IA, le expliqué cómo tenía que funcionar el flujo y nos pusimos a laburar. Esta es la cronología de cómo una idea se convirtió en un monstruo de aplicación en solo un puñado de días de trabajo real:

## ⏳ Bitácora de Desarrollo: El Camino del Hito

* **23 de Abril al 1 de Mayo [La era de la consola]:** Arrancamos con una terminal de Python súper tosca. Funcionaba, pero era incómoda: te preguntaba todo paso por paso y si le errabas a una letra, se rompía. El 1 de mayo decidí que esto tenía que ser una aplicación de verdad.
* **1 al 3 de Mayo [El primer prototipo]:** Salió la primera versión web. Era horrible, no tenía diseño propio, no tenía fotos, ni bot, ni gracia. Creí que el proyecto estaba "terminado" y lo colgué el 3 de mayo.
* **19 de Mayo [El regreso]:** Retomé el código. Metí un montón de mejoras pero sentía que todavía estaba muy incompleta. Lo volví a pausar.
* **30 de Mayo [El gran rediseño]:** Acá cambió todo. Me metí de cabeza a hacer un rediseño estético total, armé el sistema para guardar múltiples emisores, enviar las facturas y estructurar casi todo el núcleo que se usa hoy. 
* **1 de Junio [Expandiendo el negocio]:** Tras un día de descanso, programé las órdenes de trabajo técnicas, corregí los formatos de sus PDFs y diseñé el sistema de presupuestos limpios y estéticos.
* **22 de Junio [La Consagración]:** Llegamos a hoy. Después de un parate, le metí un rediseño de interfaz premium, el contador/tablero de IVA dinámico y toda la arquitectura del backend en la nube con Supabase.

> 💡 **La Moraleja:** *FacturAPP es la demostración viva de que con poco se puede hacer muchísimo. En pocos días de foco podés construir software real y avanzado sin saber programar de antemano. La IA es una herramienta inteligentísima y ultrapoderosa, pero de ninguna manera es nuestro reemplazo: necesita de tu mano, de tu lógica y de tu criterio para armar el backend, conectar un bot y dirigir la orquesta. Si la sabés usar, tenés superpoderes. Y aunque no logré facturarlo como quería por temas legales, me llevo la tremenda experiencia que me va a servir para que el día de mañana sea muchísimo mejor.*

---

## 🤝 El Elenco de Copilotos (Créditos de IA)

Este proyecto no hubiera sido posible sin un conjunto de herramientas espectaculares que merecen muchísimo mérito por haberme guiado y aportado sus superpoderes en cada etapa:

* **Claude:** El pionero. Fue el motor con el que arranqué el 23 de abril, el que me ayudó a picar las primeras líneas en la terminal de Python y a estructurar la lógica inicial del problema de mi viejo.
* **Gemini:** El especialista visual. Fue una ayuda gigante para pulir la interfaz, resolver el manejo de fotos, el diseño estético premium y darle ese look imponente de "Ferrari" que tiene la app hoy.
* **Kimi & Mimo v2.5:** Guías fundamentales que sirvieron de soporte técnico y de consulta para destrabar conceptos, optimizar flujos de datos y mantener el ritmo de desarrollo.
* **OpenCode & Nano Banana:** Herramientas clave que aportaron soluciones, referencias de código abierto y dinamismo para resolver bugs específicos y estructurar módulos del sistema.

---

## 🛠️ Stack Técnico

* **Frontend:** HTML5, CSS3 Premium (Variables nativas, CSS Grid/Flexbox, skeleton loaders para carga limpia).
* **JavaScript:** Vanilla ES6+ (Arquitectura modular, limpia y sin frameworks pesados).
* **Entorno Mobile:** Capacitor v8 (Empaquetado nativo para Android).
* **Backend & Base de Datos:** Supabase (PostgreSQL con Row Level Security - RLS para blindar los datos).
* **Motor de PDFs:** jsPDF v2.5.1 + pdf.js (Generación directa en el cliente y vista previa con Zoom).
* **Integración de Mensajería:** Telegram Bot API (Ecosistema conectado para alertas y envío de PDFs).
* **Persistencia Local-First:** Sincronización dual entre `localStorage` y la nube con cola de espera de 2 segundos.

---

## 🔥 Funcionalidades que la rompen

1.  **Asistente en 5 Pasos:** Flujo dinámico para emitir comprobantes sin margen de error.
2.  **Documentación Múltiple:** Soporte para Facturas tradicionales (SaaS dark/red), Presupuestos visuales, Órdenes de Trabajo y Notas de Crédito rectificativas.
3.  **Dashboard de Control de IVA:** Grilla inteligente 2x2 que calcula en tiempo real ingresos del mes, cobrados, pendientes y gastos deducibles (13 categorías).
4.  **Ecosistema Telegram Bot:** Vinculación por código de seguridad para recibir los PDFs directo en el celular y alertas automáticas de facturas vencidas a los 30 días.
5.  **Automatización:** Generación de facturas recurrentes programadas cronológicamente al iniciar la app.
6.  **Backups Seguros:** Copias de seguridad automáticas cada 5 minutos en local con verificación de integridad y opción de exportar todo a JSON/CSV.

---

## 🗄️ Arquitectura del Backend (14 Tablas Relacionales)

Cada usuario está protegido por políticas RLS (`auth.uid() = user_id`), haciendo el sistema totalmente privado.
* `emisores` / `clientes`: Datos fiscales, logos y configuraciones.
* `facturas` / `rectificativas` / `presupuestos` / `ordenes_trabajo`: Documentación comercial.
* `catalogo`: Gestión de ítems por categorías.
* `series` / `iva_history` / `cobros` / `gastos`: Control de numeración secuencial y contabilidad.
* `recurrentes` / `tg_contacts` / `user_settings`: Tablas de automatización y conectividad.

---

## 📂 Estructura del Repositorio

```text
facturapp_output/
├── capacitor.config.json       # Configuración Android nativo
├── package.json                # Dependencias del proyecto
├── supabase_schema.sql         # Esquema de la base de datos relacional
└── www/                        # Código fuente de la SPA
    ├── index.html              # Interfaz de usuario unificada (~1510 líneas)
    ├── css/app.css             # Estilos y animaciones de diseño (~2457 líneas)
    └── js/                     # Modularización lógica (config, backend, storage, factura, app)
