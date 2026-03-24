LOVERS CALENDAR 0.9.2 - GITHUB IOS CLOUD BUILD

ЧТО ИЗМЕНЕНО
- Тутор по GitHub и iOS переведен на русский.
- Скрипт push теперь пишет полный stderr/stdout git push в лог и отдельно объясняет самые частые GitHub ошибки.
- Скрипт старается не спамить предупреждениями по переносу строк.
- Commit для этого патча: 0.9.2.

ЧТО ДЕЛАТЬ ПО ШАГАМ
1. Создай пустой репозиторий GitHub.
2. Открой KEY_API.
3. Вставь ссылку репозитория в GITHUB_REPOSITORY_URL.
4. Проверь GITHUB_USERNAME.
5. Создай GitHub PAT.
6. При создании токена обязательно дай доступ к workflow.
7. Запусти GITHUB\PUSH_TO_GITHUB.bat.
8. Если push прошел, открой Actions.
9. Открой ios-cloud-build.
10. Скачай артефакт iOS Simulator.
11. Загрузи артефакт в Appetize.

КАКОЙ ТОКЕН НУЖЕН
Вариант 1: classic PAT
- repo
- workflow

Вариант 2: fine-grained PAT
- доступ к нужному репозиторию
- Contents: Read and write
- Actions / Workflows: Read and write

ВАЖНО
- KEY_API не должен попадать в git.
- Один и тот же GitHub PAT можно использовать повторно, пока он не истек, не отозван и не был засвечен.
- Если токен уже светился в логах, коммитах, скриншотах или чате, лучше сразу создать новый.

ВАЖНО ДЛЯ 0.9.2
- Если GitHub отвечает fetch first или non-fast-forward, Windows push-скрипт сам делает fetch origin и повторяет push через force-with-lease.
- Это сделано под твой маршрут с новыми архивами патчей, где локальная папка часто без старой .git истории, а репозиторий на GitHub уже имеет прошлые коммиты.
- Один и тот же GitHub PAT можно использовать дальше, пока он не истек, не отозван и не был засвечен.

ВАЖНО ДЛЯ 0.9.3
- iOS cloud build больше не должен сваливаться в missing addr file из-за mobile dev server: CI сборка временно выключает devUrl и beforeDevCommand перед xcodebuild.
- xcodebuild в GitHub Actions теперь идет через Release simulator конфигурацию, чтобы собрать zip-артефакт стабильнее.
- Скрипт push по-прежнему не теряет реальную ошибку git push: stderr пишется в лог целиком, без обрыва на первой строке.


0.9.3
- iOS GitHub Actions simulator build переведен с прямого xcodebuild/xcode-script маршрута на официальный `tauri ios build --target <simulator>` чтобы не упираться в missing server-addr / exit code 65 на CI.
- GitHub Actions обновлены: checkout v5, setup-node v5, Node.js 22 для job setup.
- JS-пакеты Tauri выровнены до 2.5.6 под Rust Tauri 2.5.6.
