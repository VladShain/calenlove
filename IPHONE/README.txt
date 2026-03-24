IPHONE 0.8.6

На Windows этот раздел используется через GitHub Actions cloud build.
Локальную сборку iOS здесь не делаем.

ДЕЙСТВИЯ:
1. Заполни KEY_API.
2. Запусти GITHUB\PUSH_TO_GITHUB.bat.
3. Открой Actions.
4. Дождись ios-cloud-build.
5. Скачай artifact и тестируй через cloud simulator.


0.9.3
- iOS GitHub Actions simulator build переведен с прямого xcodebuild/xcode-script маршрута на официальный `tauri ios build --target <simulator>` чтобы не упираться в missing server-addr / exit code 65 на CI.
- GitHub Actions обновлены: checkout v5, setup-node v5, Node.js 22 для job setup.
- JS-пакеты Tauri выровнены до 2.5.6 под Rust Tauri 2.5.6.
