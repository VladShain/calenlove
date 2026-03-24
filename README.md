# LoversCalendar 0.9.2

Простая структура сборки:
- ANDROID -> сборка apk и готовые файлы в ANDROID/READY
- IPHONE -> локальная macOS сборка iPhone / iOS и готовые файлы в IPHONE/READY
- GITHUB -> быстрый Windows-маршрут для пуша проекта в GitHub и автосборки iOS в облаке
- EXE -> сборка Windows exe и готовые файлы в EXE/READY
- SERVER -> серверная сборка, инструкции и будущий деплой в SERVER/READY

Главный файл настроек:
- KEY_API в корне проекта
- туда вписываются Android SDK / Java / NDK пути
- туда же вписываются облачные VITE-ключи
- туда же можно вписать URL GitHub репозитория для автопуша
- если облачные и серверные строки пустые, проект просто работает локально
- сборщики сами читают этот файл и обновляют .env.local

Главный iOS маршрут БЕЗ Mac:
1) создаёшь пустой репозиторий на GitHub
2) вставляешь его URL в KEY_API -> GITHUB_REPOSITORY_URL
3) создаёшь GitHub PAT с правами repo + workflow
4) запускаешь GITHUB\PUSH_TO_GITHUB.bat на Windows
5) проект улетает в GitHub и открывается вкладка Actions
6) workflow ios-cloud-build собирает iOS Simulator build на macOS runner
7) готовый zip скачиваешь из Actions -> Artifacts
8) этот zip можно загрузить в Appetize и смотреть итог в браузере

Что уже сделано для iOS cloud build:
- добавлен workflow .github/workflows/ios-cloud-build.yml
- GitHub на macOS runner сам собирает iOS Simulator app
- итог автоматически архивируется как zip
- артефакт сохраняется в Actions
- если добавить secret APPETIZE_API_TOKEN, workflow может сразу залить билд в Appetize
- если добавить secret APPETIZE_PUBLIC_KEY, будет обновляться уже существующий Appetize build

Главный локальный iPhone / iOS маршрут на Mac:
- основной вход: IPHONE/BUILD_IPHONE.command
- быстрая проверка среды: IPHONE/CHECK_IOS_ENV.command
- запуск в iPhone Simulator: IPHONE/RUN_IPHONE_SIMULATOR.command
- открыть Xcode проект: IPHONE/OPEN_XCODE.command
- TestFlight / App Store архив: IPHONE/BUILD_IPHONE_TESTFLIGHT.command
- готовые ipa и журналы кладутся в IPHONE/READY и logs
- iOS сборка работает только на macOS с полноценным Xcode

Что уже встроено в приложение для телефонов:
- оффлайн-first поведение: заметки и изменения остаются в localStorage при отсутствии сети
- очередь дозаписи: после возврата сети данные повторно уходят в облако / сервер
- в комнате разработчика больше диагностики: платформа, рантайм, сеть, режим хранилища и состояние очереди
- тамагочи остаются частью приложения и продолжают жить как часть интерфейса


## 0.9.2 GitHub push sync fix
- Windows push script now detects fetch first / non-fast-forward and retries with force-with-lease for the cloud build repo route.
- This helps when a new patch zip is pushed into a repository that already has an older history.

## 0.9.4 iOS cloud build fix
GitHub push обновлен для iOS cloud маршрута: скрипт сохраняет полный вывод git push в лог и точнее объясняет ошибки PAT, workflow scope, доступа к репозиторию и авторизации.
- iOS GitHub Actions маршрут дополнительно переведен в безопасный CI bundle-режим: cloud build больше не должен падать на missing addr file из-за mobile dev server.


0.9.4
- iOS GitHub Actions simulator build переведен с прямого xcodebuild/xcode-script маршрута на официальный `tauri ios build --target <simulator>` чтобы не упираться в missing server-addr / exit code 65 на CI.
- GitHub Actions обновлены: checkout v5, setup-node v5, Node.js 22 для job setup.
- JS-пакеты Tauri выровнены до 2.5.6 под Rust Tauri 2.5.6.
