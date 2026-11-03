# Импорт недостающих планировок Tchaikovsky

Проверены полные JPG-планировки в основных папках `plans/А3/Lamela A`, `Lamela B`, `Lamela C` относительно 403 квартир каталога. Отдельные 2D-картинки не считаются полными листами планировок.

| Ламель | Квартир в каталоге | Полных JPG до импорта | Не хватало | Добавлено JPG | Осталось без полного JPG |
|---|---:|---:|---:|---:|---:|
| A | 132 | 118 | 14 | 14 | 0 |
| B | 147 | 122 | 25 | 25 | 0 |
| C | 124 | 94 | 30 | 28 | 2 |

Всего: не хватало 69 полных JPG; найдено в новых PDF и добавлено 67. Сейчас полные JPG есть для 401 из 403 квартир.

## Добавленные квартиры

- **A (14):** A119, A120, A121, A122, A123, A124, A125, A126, A127, A128, A129, A130, A131, A132.
- **B (25):** B92, B93, B95, B101, B102, B112, B113, B115, B121, B122, B132, B133, B135, B136, B137, B138, B139, B140, B141, B142, B143, B144, B145, B146, B147.
- **C (28):** C96, C97, C98, C100, C101, C102, C103, C104, C105, C106, C107, C108, C109, C110, C111, C112, C113, C114, C115, C116, C117, C118, C119, C120, C121, C122, C123, C124.

## Оставшиеся отсутствующие файлы

- **C08** — нет `Lamela C/C08.jpg` и нет PDF в новой папке `Lamela_C`. В проекте присутствует только отдельная 2D-картинка `Lamela C/Lamela_C 2D/C8.png`.
- **C34** — нет `Lamela C/C34.jpg` и нет PDF в новой папке `Lamela_C`. В проекте присутствует только отдельная 2D-картинка `Lamela C/Lamela_C 2D/C34.png`.

C99.jpg уже существовал до импорта, поэтому повторно не конвертировался.

## Параметры и проверка

- Каждый исходный PDF содержит одну страницу 595 × 842 pt; номер квартиры проверен по тексту страницы.
- Конвертация: Poppler `pdftoppm`, 144 dpi, JPEG quality 95, RGB, 1190 × 1684 px, страница целиком.
- Все 67 результатов декодированы и проверены по размеру; просмотрены контактные листы всех результатов и полноразмерный C102.
- После переноса контрольные суммы 67 JPG совпадают с проверенными результатами конвертации.
- Все 335 существовавших ранее JPG в основных папках сохранили исходные контрольные суммы.

## Соответствие исходников и результатов

| Квартира | Исходный PDF | Добавленный JPG |
|---|---|---|
| A119 | `plans/А3/Lamela_A/A119.pdf` | `plans/А3/Lamela A/A119.jpg` |
| A120 | `plans/А3/Lamela_A/A120.pdf` | `plans/А3/Lamela A/A120.jpg` |
| A121 | `plans/А3/Lamela_A/A121.pdf` | `plans/А3/Lamela A/A121.jpg` |
| A122 | `plans/А3/Lamela_A/A122.pdf` | `plans/А3/Lamela A/A122.jpg` |
| A123 | `plans/А3/Lamela_A/A123.pdf` | `plans/А3/Lamela A/A123.jpg` |
| A124 | `plans/А3/Lamela_A/A124.pdf` | `plans/А3/Lamela A/A124.jpg` |
| A125 | `plans/А3/Lamela_A/A125.pdf` | `plans/А3/Lamela A/A125.jpg` |
| A126 | `plans/А3/Lamela_A/A126.pdf` | `plans/А3/Lamela A/A126.jpg` |
| A127 | `plans/А3/Lamela_A/A127.pdf` | `plans/А3/Lamela A/A127.jpg` |
| A128 | `plans/А3/Lamela_A/A128.pdf` | `plans/А3/Lamela A/A128.jpg` |
| A129 | `plans/А3/Lamela_A/A129.pdf` | `plans/А3/Lamela A/A129.jpg` |
| A130 | `plans/А3/Lamela_A/A130.pdf` | `plans/А3/Lamela A/A130.jpg` |
| A131 | `plans/А3/Lamela_A/A131.pdf` | `plans/А3/Lamela A/A131.jpg` |
| A132 | `plans/А3/Lamela_A/A132.pdf` | `plans/А3/Lamela A/A132.jpg` |
| B92 | `plans/А3/Lamela_B/B92.pdf` | `plans/А3/Lamela B/B92.jpg` |
| B93 | `plans/А3/Lamela_B/B93.pdf` | `plans/А3/Lamela B/B93.jpg` |
| B95 | `plans/А3/Lamela_B/B95.pdf` | `plans/А3/Lamela B/B95.jpg` |
| B101 | `plans/А3/Lamela_B/B101.pdf` | `plans/А3/Lamela B/B101.jpg` |
| B102 | `plans/А3/Lamela_B/B102.pdf` | `plans/А3/Lamela B/B102.jpg` |
| B112 | `plans/А3/Lamela_B/B112.pdf` | `plans/А3/Lamela B/B112.jpg` |
| B113 | `plans/А3/Lamela_B/B113.pdf` | `plans/А3/Lamela B/B113.jpg` |
| B115 | `plans/А3/Lamela_B/B115.pdf` | `plans/А3/Lamela B/B115.jpg` |
| B121 | `plans/А3/Lamela_B/B121.pdf` | `plans/А3/Lamela B/B121.jpg` |
| B122 | `plans/А3/Lamela_B/B122.pdf` | `plans/А3/Lamela B/B122.jpg` |
| B132 | `plans/А3/Lamela_B/B132.pdf` | `plans/А3/Lamela B/B132.jpg` |
| B133 | `plans/А3/Lamela_B/B133.pdf` | `plans/А3/Lamela B/B133.jpg` |
| B135 | `plans/А3/Lamela_B/B135.pdf` | `plans/А3/Lamela B/B135.jpg` |
| B136 | `plans/А3/Lamela_B/B136.pdf` | `plans/А3/Lamela B/B136.jpg` |
| B137 | `plans/А3/Lamela_B/B137.pdf` | `plans/А3/Lamela B/B137.jpg` |
| B138 | `plans/А3/Lamela_B/B138.pdf` | `plans/А3/Lamela B/B138.jpg` |
| B139 | `plans/А3/Lamela_B/B139.pdf` | `plans/А3/Lamela B/B139.jpg` |
| B140 | `plans/А3/Lamela_B/B140.pdf` | `plans/А3/Lamela B/B140.jpg` |
| B141 | `plans/А3/Lamela_B/B141.pdf` | `plans/А3/Lamela B/B141.jpg` |
| B142 | `plans/А3/Lamela_B/B142.pdf` | `plans/А3/Lamela B/B142.jpg` |
| B143 | `plans/А3/Lamela_B/B143.pdf` | `plans/А3/Lamela B/B143.jpg` |
| B144 | `plans/А3/Lamela_B/B144.pdf` | `plans/А3/Lamela B/B144.jpg` |
| B145 | `plans/А3/Lamela_B/B145.pdf` | `plans/А3/Lamela B/B145.jpg` |
| B146 | `plans/А3/Lamela_B/B146.pdf` | `plans/А3/Lamela B/B146.jpg` |
| B147 | `plans/А3/Lamela_B/B147.pdf` | `plans/А3/Lamela B/B147.jpg` |
| C96 | `plans/А3/Lamela_C/C96.pdf` | `plans/А3/Lamela C/C96.jpg` |
| C97 | `plans/А3/Lamela_C/C97.pdf` | `plans/А3/Lamela C/C97.jpg` |
| C98 | `plans/А3/Lamela_C/C98.pdf` | `plans/А3/Lamela C/C98.jpg` |
| C100 | `plans/А3/Lamela_C/C100.pdf` | `plans/А3/Lamela C/C100.jpg` |
| C101 | `plans/А3/Lamela_C/C101.pdf` | `plans/А3/Lamela C/C101.jpg` |
| C102 | `plans/А3/Lamela_C/C102.pdf` | `plans/А3/Lamela C/C102.jpg` |
| C103 | `plans/А3/Lamela_C/C103.pdf` | `plans/А3/Lamela C/C103.jpg` |
| C104 | `plans/А3/Lamela_C/C104.pdf` | `plans/А3/Lamela C/C104.jpg` |
| C105 | `plans/А3/Lamela_C/C105.pdf` | `plans/А3/Lamela C/C105.jpg` |
| C106 | `plans/А3/Lamela_C/C106.pdf` | `plans/А3/Lamela C/C106.jpg` |
| C107 | `plans/А3/Lamela_C/C107.pdf` | `plans/А3/Lamela C/C107.jpg` |
| C108 | `plans/А3/Lamela_C/C108.pdf` | `plans/А3/Lamela C/C108.jpg` |
| C109 | `plans/А3/Lamela_C/C109.pdf` | `plans/А3/Lamela C/C109.jpg` |
| C110 | `plans/А3/Lamela_C/C110.pdf` | `plans/А3/Lamela C/C110.jpg` |
| C111 | `plans/А3/Lamela_C/C111.pdf` | `plans/А3/Lamela C/C111.jpg` |
| C112 | `plans/А3/Lamela_C/C112.pdf` | `plans/А3/Lamela C/C112.jpg` |
| C113 | `plans/А3/Lamela_C/C113.pdf` | `plans/А3/Lamela C/C113.jpg` |
| C114 | `plans/А3/Lamela_C/C114.pdf` | `plans/А3/Lamela C/C114.jpg` |
| C115 | `plans/А3/Lamela_C/C115.pdf` | `plans/А3/Lamela C/C115.jpg` |
| C116 | `plans/А3/Lamela_C/C116.pdf` | `plans/А3/Lamela C/C116.jpg` |
| C117 | `plans/А3/Lamela_C/C117.pdf` | `plans/А3/Lamela C/C117.jpg` |
| C118 | `plans/А3/Lamela_C/C118.pdf` | `plans/А3/Lamela C/C118.jpg` |
| C119 | `plans/А3/Lamela_C/C119.pdf` | `plans/А3/Lamela C/C119.jpg` |
| C120 | `plans/А3/Lamela_C/C120.pdf` | `plans/А3/Lamela C/C120.jpg` |
| C121 | `plans/А3/Lamela_C/C121.pdf` | `plans/А3/Lamela C/C121.jpg` |
| C122 | `plans/А3/Lamela_C/C122.pdf` | `plans/А3/Lamela C/C122.jpg` |
| C123 | `plans/А3/Lamela_C/C123.pdf` | `plans/А3/Lamela C/C123.jpg` |
| C124 | `plans/А3/Lamela_C/C124.pdf` | `plans/А3/Lamela C/C124.jpg` |
