# Satisfacción del cliente

App del SGC de Silver Industrial para la encuesta de satisfacción (ISO 9001, 9.1.2): índice ponderado, voz del cliente y acciones para la dirección.
API: [Satisfaccion-del-Cliente-API](https://github.com/diegortizdao-collab/Satisfaccion-del-Cliente-API) (Cloudflare Worker + Neon).

## Cómo se usa
1. **Primera vez:** botón «Cargar la encuesta 2025 desde la planilla» (`data/encuesta-2025.json`, 10 respuestas de «Encuestas de satisfacción del cliente 2025.xlsx»).
2. **Encuestas nuevas:** descargá la hoja de respuestas del formulario como CSV y usá **Cargar encuestas (CSV)**. La app detecta las columnas por su nombre (la 1.ª etapa se reconoce por el sufijo «(1)») y te las muestra para corregirlas antes de importar. Volver a cargar el mismo archivo no duplica: hay una respuesta por cliente y encuesta.
3. **Encuestas enviadas:** se escribe a mano en la cabecera. Con eso se calcula el nivel de respuesta.
4. **Voz del cliente:** prioriza los temas, registra el cierre de ciclo con los clientes bajo la meta, clasifica los comentarios y arma las acciones. «Llevar a la RxD» crea la decisión propuesta en la revisión por la dirección (exige responsable).
5. **Publicar en la RxD:** acción explícita. Elegís la revisión y se escriben el índice de la 1.ª etapa y el nivel de respuesta; si ya había un valor, pide confirmación y queda en el historial de la RxD.

## Cálculo
`índice = Σ(nota × peso) ÷ (escala × Σ pesos)`, promedio de los clientes. Pesos y meta se guardan con cada encuesta (pestaña Ponderación).
1.ª etapa (escala 5): calidad ×2, cumplimiento ×2, asesoramiento ×1, comunicación ×1. 2.ª etapa (escala 3, frente a la competencia): calidad ×2, cumplimiento ×2, flexibilidad ×1,5, asesoramiento ×1, comunicación ×1.

## Configuración
`config.js` apunta a la URL del Worker. Publicar con GitHub Pages desde `main`.
