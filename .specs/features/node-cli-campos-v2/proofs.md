# node-cli-campos-v2 proofs

**HEAD**: 195d34b
**Tree**: clean
**Shell**: /bin/sh
**Result**: 40 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `npm run lint` | pass |
| C2 | `npm run build && node --test --test-reporter=spec --test-name-pattern="\[C2\]" test/toolchain.test.cjs` | pass |
| C3 | `run unit / ✔ [C3]` | pass |
| C4 | `run unit / ✔ [C4]` | pass |
| C5 | `run unit / ✔ [C5]` | pass |
| C6 | `run unit / ✔ [C6]` | pass |
| C7 | `run unit / ✔ [C7]` | pass |
| C8 | `run unit / ✔ [C8]` | pass |
| C9 | `run unit / ✔ [C9]` | pass |
| C10 | `run unit / ✔ [C10]` | pass |
| C11 | `run unit / ✔ [C11]` | pass |
| C12 | `run unit / ✔ [C12]` | pass |
| C12 | `run unit / ✔ [C12b]` | pass |
| C13 | `run unit / ✔ [C13]` | pass |
| C13 | `run unit / ✔ [C13b]` | pass |
| C14 | `run unit / ✔ [C14]` | pass |
| C15 | `run unit / ✔ [C15]` | pass |
| C37 | `run unit / ✔ [C37]` | pass |
| C36 | `run unit / ✔ [C36]` | pass |
| C16 | `run unit / ✔ [C16]` | pass |
| C17 | `run unit / ✔ [C17]` | pass |
| C18 | `run unit / ✔ [C18]` | pass |
| C19 | `run unit / ✔ [C19]` | pass |
| C20 | `run unit / ✔ [C20]` | pass |
| C21 | `run unit / ✔ [C21]` | pass |
| C22 | `run unit / ✔ [C22]` | pass |
| C23 | `run unit / ✔ [C23]` | pass |
| C24 | `run unit / ✔ [C24]` | pass |
| C25 | `run unit / ✔ [C25]` | pass |
| C26 | `run unit / ✔ [C26]` | pass |
| C27 | `run unit / ✔ [C27]` | pass |
| C28 | `run unit / ✔ [C28]` | pass |
| C29 | `run unit / ✔ [C29]` | pass |
| C30 | `run unit / ✔ [C30]` | pass |
| C31 | `run unit / ✔ [C31]` | pass |
| C32 | `run unit / ✔ [C32]` | pass |
| C33 | `run unit / ✔ [C33]` | pass |
| C34 | `run unit / ✔ [C34]` | pass |
| C35 | `npm pack --dry-run` | pass |
| Build | `npx tsc --noEmit` | pass |

## Output

`Run unit` - exit 0

```
  ✔ [C8] o README tem as seções do padrão, o selo, o índice e o número atual de operações (342.977878ms)
  ✔ [C34] a versão é 1.1.0 e a seção Versões lista as mudanças (0.5723ms)
✔ documentação e lançamento (343.847073ms)
▶ versões do node
  ✔ [C15] a lista da versão 2 omite as operações legacy e a da versão 1 as inclui (11.374693ms)
  ✔ [C16] declara version [1, 2] e defaultVersion 2 (0.61669ms)
✔ versões do node (12.777754ms)
ℹ tests 37
ℹ suites 10
ℹ pass 37
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1045.866074
```

`npm run lint` - exit 0

```
> n8n-nodes-pacto@1.1.0 lint
> n8n-node lint

┌   n8n-node lint  v0.55.5
```

`npm run build && node --test --test-reporter=spec --test-name-pattern="\[C2\]" test/toolchain.test.cjs` - exit 0

```
◇  Copied static files
│
└  ✓ Build successful

▶ toolchain do node-cli
  ✔ [C2] o build gera o node, a credencial e os ícones no dist (0.839128ms)
✔ toolchain do node-cli (2.139986ms)
ℹ tests 1
ℹ suites 1
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 61.345287
```

`npm pack --dry-run` - exit 0

```
npm notice 1.4kB dist/nodes/Pacto/transport/index.js
npm notice 1.2kB dist/nodes/Pacto/transport/index.js.map
npm notice 2.2kB dist/package.json
npm notice 102.5kB dist/tsconfig.tsbuildinfo
npm notice 1.8kB package.json
npm notice Tarball Details
npm notice name: n8n-nodes-pacto
npm notice version: 1.1.0
npm notice filename: n8n-nodes-pacto-1.1.0.tgz
npm notice package size: 2.7 MB
npm notice unpacked size: 46.5 MB
npm notice shasum: ae19bc6bc4a5bf9520d94b39aa2c2ef3d7f7b1e1
npm notice integrity: sha512-McO5l8TCCLUsO[...]/R3bfPWnCqgbg==
npm notice total files: 40
npm notice
```
