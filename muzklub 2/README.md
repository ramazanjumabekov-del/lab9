# MuzKlub

Учебный сайт музыкальной группы на React + TypeScript + Vite: регистрация, вход, выход, просмотр и редактирование своего профиля (имя, инструмент, описание, гонорар). Работает с учебным JWT API: https://inai-col3.fishrungames.com/api/docs/

## Запуск

Нужен Node.js 22.13 или новее (рекомендуется 24).

```bash
npm ci
npm run dev        # режим разработки
npm test           # тесты JWT-логики без реального API
npm run typecheck  # проверка TypeScript
npm run build      # проверка типов + production-сборка в dist/
npm run preview
```

## Структура

```
src/
├── main.tsx                  # запуск React
├── App.tsx                   # выбирает экран: вход, профиль или редактирование
├── config.ts                 # список инструментов по умолчанию
├── api/
│   ├── index.ts              # запросы, JWT, обновление токена, выход
│   ├── errors.ts             # ApiError и разбор текста ошибок
│   └── types.ts              # User, Profile, Choice
├── hooks/useMuzKlub.ts       # состояние и действия приложения
├── components/
│   ├── Header.tsx
│   ├── Notices.tsx           # плашка загрузки и сообщения
│   ├── AuthForm.tsx          # вход и регистрация
│   ├── ProfileView.tsx       # просмотр профиля
│   └── ProfileForm.tsx       # редактирование профиля
└── styles/index.css          # стили (светлая и тёмная тема)
tests/api.test.mjs
```

## Авторизация

Запросы идут на `https://inai-col3.fishrungames.com/api/`. Регистрация и вход возвращают JWT access в JSON и ставят refresh в HttpOnly cookie. Access хранится только в памяти и передаётся в заголовке `Authorization: Bearer <access>`. Пароли и токены не записываются в localStorage или sessionStorage.

При перезагрузке страницы приложение вызывает `POST /token/refresh/`, получает access и загружает профиль. При ответе `401` оно обновляет access и один раз повторяет запрос; одновременные запросы используют одно обновление. Если refresh истёк, показывается форма входа.

Для cookie используется `credentials: 'include'`: браузер должен разрешать cookie учебного API. При выходе вызывается `POST /logout/`, access очищается, а в localStorage пишется только отметка `muzklub.loggedOut=1`, которая запрещает автоматический вход после выхода.

Известная особенность сервера (проверка 11.11.2026): ответ logout удаляет refresh cookie без `SameSite=None; Secure`, и браузер отклоняет удаление при запросе с другого сайта. Отметка выхода защищает от повторного входа; чтобы cookie удалялась, нужно исправить backend: `response.delete_cookie('refresh_token', path='/api/', samesite='None')`.

Методы API: `POST /register/`, `/login/`, `/token/refresh/`, `/logout/`, `GET/PATCH /profile/`, `GET /specializations/`.

## GitHub Pages

Workflow `.github/workflows/deploy.yml` запускается при push в `main`: `npm ci`, тесты, сборка, публикация `dist`. Путь `/<имя-репозитория>/` подставляется через переменную `BASE_PATH`, так что репозиторий можно назвать как угодно. В настройках: Settings → Pages → Source: **GitHub Actions**.
