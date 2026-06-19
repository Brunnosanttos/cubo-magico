# Cubo Mágico Solver

Aponte a câmera para cada face do cubo, deixe a captura automática trabalhar e veja a solução
animada em 3D — tudo offline, direto no navegador.

## Stack

- React + Vite + TypeScript
- Tailwind CSS
- Three.js (renderização 3D)
- OpenCV.js (carregado sob demanda — usado apenas para detecção de nitidez)
- [cubejs](https://www.npmjs.com/package/cubejs) (resolução)
- zustand (estado)
- vite-plugin-pwa (modo offline)

100 % frontend. Nenhum backend, banco ou API externa.

## Como rodar

```bash
npm install
npm run dev          # http://localhost:5173
```

Para testar no celular use `localhost` via tunelamento HTTPS (a câmera exige
contexto seguro):

```bash
# exemplo com cloudflared
cloudflared tunnel --url http://localhost:5173
```

## Build de produção

```bash
npm run build
npm run preview -- --host
```

## Estrutura

```
src/
 ├── components/        # UI reutilizável (CameraView, Cube3D, controls…)
 ├── pages/             # HomePage, ScannerPage, SolverPage, HowItWorksPage
 ├── hooks/             # useCamera, useColorDetection, useStableCapture…
 ├── services/
 │    ├── camera/             # getUserMedia
 │    ├── colorDetection/     # amostragem HSV + classificação + qualidade
 │    ├── cubeSolver/         # wrapper cubejs
 │    └── cubeValidation/     # 54 stickers, 9 por cor, centros distintos
 ├── stores/            # zustand
 ├── types/             # CubeColor, FaceName, Move…
 └── utils/             # colorSpace, cubeNotation
```

## Fluxo

1. **Home** — botão "Escanear Cubo".
2. **Scanner** — guia para escanear as 6 faces (F → R → B → L → U → D).
   Para cada face: indicadores de luz/foco/enquadramento, grade 3×3 com cores
   detectadas em tempo real, captura automática após ~1 s de estabilidade.
3. **Correção manual** — toque em qualquer adesivo da miniatura para trocar a cor.
4. **Validação** — exige 54 adesivos, 9 por cor e 6 centros distintos antes de
   resolver. Faces suspeitas são listadas para recaptura.
5. **Solver** — cubejs gera a sequência; um cubo 3D em Three.js executa cada giro
   com animação suave e instruções textuais.

## PWA

A primeira carga registra um service worker. Depois disso o app funciona offline.
Adicione `public/icon-192.png` e `public/icon-512.png` para o "Instalar app".

## Licença

MIT.
