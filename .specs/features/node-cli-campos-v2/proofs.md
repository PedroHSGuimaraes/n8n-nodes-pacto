# node-cli-campos-v2 proofs

**HEAD**: 2ba1a34
**Tree**: clean
**Shell**: /bin/sh
**Result**: 48 pass, 0 fail

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
| C42 | `run unit / ✔ [C42]` | pass |
| C43 | `run unit / ✔ [C43]` | pass |
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
| C31 | `run unit / ✔ [C31b]` | pass |
| C32 | `run unit / ✔ [C32]` | pass |
| C33 | `run unit / ✔ [C33]` | pass |
| C34 | `run unit / ✔ [C34]` | pass |
| C44 | `run unit / ✔ [C44]` | pass |
| C35 | `run unit / ✔ [C35]` | pass |
| C38 | `run unit / ✔ [C38]` | pass |
| C39 | `run unit / ✔ [C39]` | pass |
| C40 | `run unit / ✔ [C40]` | pass |
| C41 | `run unit / ✔ [C41]` | pass |
| Build | `npx tsc --noEmit` | pass |

## Output

`Run unit` - exit 0

```
  ✔ [C34] a versão é 1.1.0 e a seção Versões lista as mudanças (0.293018ms)
  ✔ [C35] o pacote 1.1.0 empacota o node, a credencial e os ícones, e o publish aciona o stage na tag (1318.274587ms)
✔ documentação e lançamento (1622.896234ms)
▶ versões do node
  ✔ [C15] a lista da versão 2 omite as operações legacy e a da versão 1 as inclui (12.417749ms)
  ✔ [C16] declara version [1, 2] e defaultVersion 2 (0.833337ms)
✔ versões do node (14.196587ms)
ℹ tests 46
ℹ suites 11
ℹ pass 46
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1707.056625
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
  ✔ [C2] o build gera o node, a credencial e os ícones no dist (0.753785ms)
✔ toolchain do node-cli (1.944841ms)
ℹ tests 1
ℹ suites 1
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 37.34709
```
