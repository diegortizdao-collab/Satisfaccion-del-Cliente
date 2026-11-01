# Satisfacción del cliente

App del SGC de Silver Industrial para la encuesta de satisfacción (ISO 9001, 9.1.2): índice ponderado, voz del cliente y acciones para la dirección.
API: [Satisfaccion-del-Cliente-API](https://github.com/diegortizdao-collab/Satisfaccion-del-Cliente-API) (Cloudflare Worker + Neon).

## Cómo se usa
1. **Primera vez:** botón «Cargar la encuesta 2025 desde la planilla» (`data/encuesta-2025.json`, 10 respuestas de «Encuestas de satisfacción del cliente 2025.xlsx»).
2. **Encuestas nuevas:** descargá la hoja de respuestas del formulario como CSV y usá **Cargar encuestas (CSV)**. La app detecta las columnas por su nombre (la 1.ª etapa se reconoce por el sufijo «(1)») y te las muestra para corregirlas antes de importar. Volver a cargar el mismo archivo no duplica: hay una respuesta por cliente y encuesta.
3. **Encuestas enviadas:** se escribe a mano en la cabecera. Con eso se calcula el nivel de respuesta.
4. **Voz del cliente:** prioriza los temas, registra el cierre de ciclo con los clientes bajo la meta, clasifica los comentarios y arma las acciones. «Llevar a la RxD» crea la decisión propuesta en la revisión por la dirección (exige responsable).
5. **Publicar en la RxD:** acción explícita. Elegís la revisión y se escriben el índice de la 1.ª etapa y el nivel de respuesta; si ya había un valor, pide confirmación y queda en el historial de la RxD.

## Regla de años
La encuesta «2025» mide el período 2025, se hace a principios de 2026 y entra en la RxD 2026. La de 2026 se hará en 2027 y entrará en la RxD 2027. Por eso «Publicar» propone por defecto la RxD del año de la encuesta + 1, y el Histórico compara cada encuesta con lo que figura en la RxD del año siguiente.

## Duplicados
Hay una respuesta por cliente y encuesta. Al cargar un CSV: las repetidas con las mismas notas se ignoran; las que vienen con notas distintas se muestran para que elijas mantener la cargada o reemplazarla. «Reemplazar todas» actualiza por cliente y quita solo las que no vienen en el archivo; nunca borra antes de insertar.

## Cálculo
`índice = Σ(nota × peso) ÷ (escala × Σ pesos)`, promedio de los clientes. Pesos y meta se guardan con cada encuesta (pestaña Ponderación).
1.ª etapa (escala 5): calidad ×2, cumplimiento ×2, asesoramiento ×1, comunicación ×1. 2.ª etapa (escala 3, frente a la competencia): calidad ×2, cumplimiento ×2, flexibilidad ×1,5, asesoramiento ×1, comunicación ×1.

## Configuración
`config.js` apunta a la URL del Worker. Publicar con GitHub Pages desde `main`.
