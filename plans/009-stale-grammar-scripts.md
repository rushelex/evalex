# Скрипты `generate:grammar` без исполняемого файла

## Резюме

В `package.json` объявлены `generate:grammar` и `generate:grammar:watch`, оба запускают `node scripts/generate-grammar.ts`. Директории `scripts/` в репозитории нет, команда падает. Парсер написан руками (`src/parser/grammar/parser.ts`) и генерации не требует.

**Цель**: в `package.json` нет команд, которые нельзя выполнить.

---

## 1. Текущее состояние

```
$ pnpm generate:grammar
Error: Cannot find module '…/scripts/generate-grammar.ts'
```

- Скрипт был генератором парсера на Peggy; Peggy в зависимостях нет.
- Кроме `package.json`, на скрипт ничего не ссылается: ни хуки, ни конфиги, ни документация.

## 2. Этапы

1. Удалить оба скрипта из `package.json`.

## 3. Проверка

- `pnpm run` не показывает `generate:grammar`.
- `pnpm build`, `pnpm test` зелёные.
