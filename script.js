import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getDatabase, ref, push, set, onValue, remove } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

// Ваша конфигурация Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDCD5MSC1-hFrXK2JD-rAkjbM4DmBTaYAo",
  authDomain: "koworking-5a698.firebaseapp.com",
  databaseURL: "https://koworking-5a698-default-rtdb.firebaseio.com",
  projectId: "koworking-5a698",
  storageBucket: "koworking-5a698.firebasestorage.app",
  messagingSenderId: "600778210650",
  appId: "1:600778210650:web:c7d3fa1a68ceae7ae4c763",
  measurementId: "G-KPY9KC2XNE"
};

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app); // Инициализация Firebase Auth

// ====== Глобальные переменные ======
let dialogs = []; // Список диалогов
let currentDialog = null; // Текущий выбранный диалог
let currentUser = null; // Текущий пользователь (выбранная роль)
let currentUserId = null; // UID текущего аутентифицированного пользователя Firebase
let telegramUsername = null; // @username пользователя Telegram Mini App (если доступно)

// ====== Навигация между экранами ======
function showScreen(screen) {
  // Показываем нужный экран, скрываем другой
  document.getElementById('dialogs-screen').style.transform = (screen === 'dialogs') ? 'translateX(0)' : 'translateX(-100vw)';
  document.getElementById('chat-screen').classList.toggle('active', screen === 'chat');
  // Скрываем/показываем кнопку "Назад" в зависимости от экрана
  document.getElementById('back-btn').style.display = (screen === 'chat') ? 'block' : 'none';
}

// ====== Загрузка списка диалогов ======
function loadDialogs() {
  // Получаем ссылку на узел 'dialogs' в базе данных
  const dialogsRef = ref(db, 'dialogs');

  // Подписываемся на изменения в 'dialogs' (слушаем в реальном времени)
  onValue(dialogsRef, (snapshot) => {
    const data = snapshot.val();
    dialogs = []; // Очищаем текущий список диалогов
    if (data) {
      // Перебираем данные и формируем массив диалогов
      for (let id in data) {
        dialogs.push({ id: id, ...data[id] });
      }
    }
    renderDialogs(); // Рендерим обновленный список
  }, (error) => {
    console.error("Ошибка при загрузке диалогов: ", error);
    showErrorModal("Ошибка при загрузке диалогов. Попробуйте обновить страницу.");
  });
}

// ====== Рендер списка диалогов ======
function renderDialogs() {
  const list = document.getElementById('dialogs-list');
  list.innerHTML = '';
  // Если диалогов нет, показываем сообщение
  if (dialogs.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:#666;padding-top:20px;">Пока нет диалогов. Создайте новый или импортируйте.</p>';
    return;
  }
  // Рендерим каждый диалог
  dialogs.forEach(dialog => {
    const item = document.createElement('div');
    item.className = 'dialog-item';
    item.innerHTML = `
      <span>${dialog.title || 'Без названия'}</span>
      <button class="delete-btn" data-dialog-id="${dialog.id}">✕</button>
    `;
    // Обработчик для открытия диалога
    item.onclick = (e) => {
      // Предотвращаем срабатывание при клике на кнопку удаления
      if (e.target.classList.contains('delete-btn')) return;
      openDialog(dialog.id);
    };
    list.appendChild(item);
  });

  // Добавляем обработчики для кнопок удаления (делегирование событий)
  list.querySelectorAll('.delete-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation(); // Останавливаем всплытие, чтобы не сработал openDialog
      const dialogId = e.target.dataset.dialogId;
      deleteDialog(dialogId);
    };
  });
}

// ====== Создание нового диалога ======
function createDialog() {
  const newDialogRef = push(ref(db, 'dialogs')); // Генерируем новый уникальный ключ
  const dialogData = {
    title: "Новый диалог " + new Date().toLocaleString(), // Простой заголовок по умолчанию
    creatorUsername: telegramUsername || 'web_user', // Сохраняем Telegram username или пометку для веб-пользователя
    participants: {},
    messages: []
  };
  set(newDialogRef, dialogData)
    .then(() => {
      console.log("Новый диалог создан!");
      openDialog(newDialogRef.key);
    })
    .catch((error) => {
      console.error("Ошибка при создании диалога: ", error);
      showErrorModal("Не удалось создать новый диалог.");
    });
}

document.getElementById('new-dialog-btn').onclick = createDialog;

// ====== Удаление диалога ======
function deleteDialog(dialogId) {
  const dialogToDelete = dialogs.find(d => d.id === dialogId);
  const dialogTitle = dialogToDelete ? dialogToDelete.title : 'Без названия';

  showModal(`
    <div style="padding:20px;text-align:center;">
      <h3 style="margin-top:0;">Подтвердите удаление</h3>
      <p>Вы уверены, что хотите удалить диалог "${dialogTitle}"?</p>
      <button class="btn" id="confirm-delete-btn" style="margin-top:20px;">Удалить</button>
      <button class="btn btn-danger" onclick="closeModal()" style="margin-top:10px;">Отмена</button>
    </div>
  `);

  document.getElementById('confirm-delete-btn').onclick = () => {
    closeModal(); // Закрываем модалку перед удалением
    const dialogRef = ref(db, 'dialogs/' + dialogId);
    remove(dialogRef)
      .then(() => {
        console.log("Диалог удален: ", dialogId);
        if (currentDialog && currentDialog.id === dialogId) {
          currentDialog = null;
          showScreen('dialogs');
        }
      })
      .catch((error) => {
        console.error("Ошибка при удалении диалога: ", error);
        showErrorModal("Не удалось удалить диалог. " + error.message);
      });
  };
}

// ====== Открытие диалога ======
function openDialog(dialogId) {
  const dialogRef = ref(db, 'dialogs/' + dialogId);
  onValue(dialogRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      currentDialog = { id: dialogId, ...data };
      document.getElementById('chat-title').textContent = currentDialog.title || 'Чат';
      renderMessages();
      showScreen('chat');
    } else {
      console.warn("Диалог не найден: ", dialogId);
      showErrorModal("Выбранный диалог не найден или был удален.");
      showScreen('dialogs');
    }
  }, (error) => {
    console.error("Ошибка при открытии диалога: ", error);
    showErrorModal("Не удалось открыть диалог.");
  });
}

document.getElementById('back-btn').onclick = () => {
  showScreen('dialogs');
};

// ====== Импорт чата из result.json ======
function importChatFromFile(file) {
  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const chatData = JSON.parse(e.target.result);
      const dialogTitle = chatData.name || 'Импортированный чат';
      const rawMessages = chatData.messages || [];

      const participants = {};
      // Определяем участников чата
      rawMessages.forEach(msg => {
        if (msg.from && msg.from_id) {
          participants[msg.from_id] = msg.from;
        }
      });

      // Форматируем сообщения для Firebase, добавляя цвет и пометку
      const formattedMessages = rawMessages.map(msg => {
        return {
          id: msg.id,
          from: msg.from,
          from_id: msg.from_id,
          text: typeof msg.text === 'string' ? msg.text : msg.text.map(entity => typeof entity === 'string' ? entity : entity.text).join(''), // Обработка массивов текста/эмодзи
          date: msg.date,
          date_unixtime: msg.date_unixtime,
          color: '#ffffff', // Цвет по умолчанию для сообщений собеседника
          annotation: '' // Пометка для админки
        };
      });

      const newDialogRef = push(ref(db, 'dialogs'));
      const dialogData = {
        title: dialogTitle,
        creatorUsername: telegramUsername || 'web_user', // Сохраняем Telegram username или пометку для веб-пользователя
        participants: participants,
        messages: formattedMessages
      };

      set(newDialogRef, dialogData)
        .then(() => {
          console.log("Чат успешно импортирован!", newDialogRef.key);
          openDialog(newDialogRef.key);
          // После импорта автоматически предлагаем выбрать пользователя
          const participantNames = Object.values(participants);
          if (participantNames.length > 0) {
            chooseUser(participantNames);
          }
        })
        .catch((error) => {
          console.error("Ошибка при сохранении импортированного чата: ", error);
          showErrorModal("Не удалось сохранить импортированный чат в базу данных.");
        });

    } catch (error) {
      console.error("Ошибка при парсинге JSON файла: ", error);
      showErrorModal("Некорректный формат JSON файла. Убедитесь, что это файл экспорта Telegram.");
    }
  };

  reader.onerror = () => {
    showErrorModal("Не удалось прочитать файл. Возможно, он поврежден или у вас нет доступа.");
  };

  reader.readAsText(file);
}

document.getElementById('chat-menu-btn').onclick = () => {
  // TODO: Открыть меню с импортом и выбором пользователя
  showModal(`
    <div style="padding:20px;">
      <h3 style="margin-top:0;">Меню чата</h3>
      <input type="file" id="import-json-file" accept=".json" style="display:none;"/>
      <button class="btn" onclick="document.getElementById('import-json-file').click();">Импортировать чат</button>
      <button class="btn" id="choose-user-btn" style="margin-top:10px;">Выбрать пользователя</button>
      <button class="btn btn-danger" onclick="closeModal()" style="margin-top:10px;">Отмена</button>
    </div>
  `);

  document.getElementById('import-json-file').onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      closeModal();
      importChatFromFile(file);
    }
  };
  document.getElementById('choose-user-btn').onclick = () => {
    closeModal();
    // TODO: Вызвать функцию выбора пользователя
    if (currentDialog && currentDialog.participants) {
      chooseUser(Object.values(currentDialog.participants));
    } else {
      showErrorModal("Для выбора пользователя сначала импортируйте чат.");
    }
  };
};

// ====== Рендер сообщений ======
function renderMessages() {
  const container = document.getElementById('messages-container');
  container.innerHTML = '';

  if (!currentDialog || !currentDialog.messages || currentDialog.messages.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:#666;padding-top:20px;">Сообщений пока нет. Импортируйте чат.</p>';
    return;
  }

  // Сортируем сообщения по времени отправки, если они не отсортированы
  currentDialog.messages.sort((a, b) => new Date(a.date) - new Date(b.date));

  let lastSenderId = null;
  let lastIsMine = false;

  currentDialog.messages.forEach((msg, index) => {
    const isMine = (currentUser && msg.from === currentUser);
    const messageGroup = document.createElement('div');
    messageGroup.className = 'message-group';
    if (isMine) {
      messageGroup.classList.add('mine');
    }

    const messageBubble = document.createElement('div');
    messageBubble.className = 'message-bubble';
    messageBubble.textContent = msg.text;

    // Применяем цвет из данных сообщения, если это сообщение собеседника и есть цвет
    // Ваши сообщения всегда будут синими по CSS, если не переопределено
    if (!isMine && msg.color) { // Если не наше сообщение, используем цвет из Firebase
        messageBubble.style.backgroundColor = msg.color;
    }

    const messageTime = document.createElement('div');
    messageTime.className = 'message-time';
    const messageDate = new Date(msg.date);
    messageTime.textContent = `${messageDate.getHours().toString().padStart(2, '0')}:${messageDate.getMinutes().toString().padStart(2, '0')}`;

    messageGroup.appendChild(messageBubble);
    messageGroup.appendChild(messageTime);
    container.appendChild(messageGroup);

    // Логика визуальной группировки: уменьшаем отступ, если следующее сообщение от того же отправителя и того же типа
    const nextMsg = currentDialog.messages[index + 1];
    if (nextMsg) {
      const nextIsMine = (currentUser && nextMsg.from === currentUser);
      if (msg.from_id === nextMsg.from_id && isMine === nextIsMine) {
        messageGroup.style.marginBottom = '2px'; // Меньший отступ для сгруппированных сообщений
      }
    }

    lastSenderId = msg.from_id; // Обновляем последнего отправителя
    lastIsMine = isMine; // Обновляем тип последнего сообщения
  });

  // Прокрутка к последнему сообщению
  container.scrollTop = container.scrollHeight;
}

// ====== Выбор пользователя (роль) ======
function chooseUser(users) {
  // TODO: Показать модалку выбора пользователя
  if (!users || users.length === 0) {
    showErrorModal("Нет доступных пользователей для выбора.");
    return;
  }

  let userOptionsHtml = users.map(user => 
    `<button class="btn" data-user="${user}">${user}</button>`
  ).join('');

  showModal(`
    <div style="padding:20px;">
      <h3 style="margin-top:0;">Выберите, от чьего лица просматривать чат:</h3>
      ${userOptionsHtml}
      <button class="btn btn-danger" onclick="closeModal()" style="margin-top:10px;">Отмена</button>
    </div>
  `);

  document.querySelectorAll('#modal-content .btn[data-user]').forEach(btn => {
    btn.onclick = (e) => {
      currentUser = e.target.dataset.user;
      console.log("Выбран пользователь: ", currentUser);
      closeModal();
      renderMessages(); // Перерендеринг сообщений после выбора пользователя
    };
  });
}

// ====== Модалки ======
function showModal(contentHtml) {
  document.getElementById('modal-content').innerHTML = contentHtml;
  document.getElementById('modal').classList.add('active');
}
function closeModal() {
  document.getElementById('modal').classList.remove('active');
}
// Закрытие модалки при клике вне содержимого
document.getElementById('modal').onclick = (e) => {
  if (e.target === document.getElementById('modal')) closeModal();
};

// ====== Уведомления об ошибках (модалка) ======
function showErrorModal(message) {
  showModal(`
    <div style="padding:20px;text-align:center;">
      <h3 style="color:#ff3b30;margin-top:0;">Ошибка!</h3>
      <p>${message}</p>
      <button class="btn" onclick="closeModal()">ОК</button>
    </div>
  `);
}

// ====== Инициализация приложения ======
function init() {
  showScreen('dialogs');

  // Анонимный вход в Firebase Authentication
  signInAnonymously(auth)
    .then(() => {
      // Пользователь вошел анонимно (или уже был вошел)
      onAuthStateChanged(auth, (user) => {
        if (user) {
          currentUserId = user.uid; // Сохраняем UID пользователя
          console.log("Анонимный пользователь вошел с UID:", currentUserId);

          // Проверяем, запущен ли сайт в Telegram Mini App и получаем username
          if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
            telegramUsername = window.Telegram.WebApp.initDataUnsafe.user.username || 'unknown_telegram_user';
            console.log("Запущено в Telegram Mini App. Username:", telegramUsername);
          } else {
            console.log("Запущено не в Telegram Mini App.");
          }

          loadDialogs(); // Загружаем диалоги только после успешной аутентификации и попытки получения Telegram username
        } else {
          console.warn("Пользователь вышел или не смог войти анонимно.");
          showErrorModal("Не удалось выполнить вход в приложение. Попробуйте обновить страницу.");
        }
      });
    })
    .catch((error) => {
      console.error("Ошибка анонимного входа:", error);
      showErrorModal("Не удалось подключиться к сервисам Firebase. Проверьте ваше интернет-соединение.");
    });
}

window.onload = init; 
