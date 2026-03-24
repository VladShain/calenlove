ANDROID - LOCAL APK BUILD

Главный маршрут:
1. Заполни KEY_API в корне проекта
2. Запусти ANDROID\APK_BUILD.bat
3. Готовый installable APK ищи в ANDROID\READY
4. Для установки на телефон: ANDROID\INSTALL_APK.bat

Что поменялось в 0.5.9:
- После строки Finished 1 APK at сборщик теперь пишет шаги после Tauri: проверка сертификатов, подпись и копирование в READY.
- Проверка сертификатов сначала смотрит подписи внутри APK, а уже потом зовёт apksigner.
- Устанавливать нужно только APK из ANDROID\READY после финального сообщения о завершении пайплайна.
- по базе для локального теста сборка идёт как debug и только под aarch64
- это режет лишние ABI и уменьшает время сборки
- APK перед копированием в READY теперь проходит проверку сертификатов
- если Tauri всё же отдаёт unsigned APK, сборщик сам подписывает его после build
- Gradle вынесен в project-local cache, чтобы не упираться в битый пользовательский ~/.gradle

Поля KEY_API для Android:
- APK_BUILD_PROFILE=debug    -> базовый режим для локального installable APK
- APK_BUILD_PROFILE=release  -> release build, если нужен именно release маршрут
- APK_TARGETS=aarch64        -> по базе только arm64 для телефона
- APK_TARGETS=aarch64,armv7  -> если захочешь несколько target
- APK_SIGN_MODE=debug        -> режим подписи по умолчанию
- APK_SIGN_MODE=unsigned     -> пропустить подпись и оставить исходный unsigned apk
- APK_KEYSTORE_PATH=...      -> путь к своему keystore
- APK_KEY_ALIAS=...          -> alias ключа
- APK_STORE_PASSWORD=...     -> пароль keystore
- APK_KEY_PASSWORD=...       -> пароль ключа
- APK_KEY_DNAME=...          -> DN для автогенерации debug keystore, если нужен свой текст
- GRADLE_USER_HOME=...       -> свой путь для Gradle cache, если не хочешь базовый

Логи:
- основной лог сборщика: logs\apk_build_LATEST.log
- лог tauri android build: logs\android-build_LATEST.log

0.5.9
- READY получает только APK, который прошёл проверку сертификатов.
- По базе сборка делается быстрее: debug + aarch64 only.
- Project-local Gradle cache помогает уйти от CorruptedCacheException в глобальном кэше.
