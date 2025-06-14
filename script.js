import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js";

/* script.js - Логика для iOS-подобного мессенджера */

document.addEventListener('DOMContentLoaded', () => {
    const newDialogBtn = document.getElementById('new-dialog-btn');
    const chatList = document.querySelector('.chat-list');
    const noDialogsMessage = document.querySelector('.no-dialogs-message');

    const chatListScreen = document.getElementById('chat-list-screen'); // Новый элемент
    const chatScreen = document.getElementById('chat-screen'); // Новый элемент
    const chatTitle = document.getElementById('chat-title');
    const backButton = document.querySelector('.back-button');
    const messagesContainer = document.querySelector('.messages-container');
    const messageInput = document.getElementById('message-input');
    const sendMessageBtn = document.getElementById('send-message-btn');
    const moreOptionsButton = document.querySelector('.more-options-button');
    const optionsMenu = document.querySelector('.options-menu');
    const importMessagesBtn = document.getElementById('import-messages-btn');
    const importModal = document.querySelector('.import-modal');
    const telegramDialogInput = document.getElementById('telegram-dialog-input');
    const processImportBtn = document.getElementById('process-import-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');

    // Новые элементы для кастомного модального окна создания диалога
    const newDialogModal = document.getElementById('new-dialog-modal');
    const participant1Input = document.getElementById('participant1-input');
    const participant2Input = document.getElementById('participant2-input');
    const createNewDialogBtn = document.getElementById('create-new-dialog-btn');
    const cancelNewDialogBtn = document.getElementById('cancel-new-dialog-btn');

    // Элементы для меню редактирования сообщений
    const messageEditorMenu = document.getElementById('message-editor-menu');
    const markGreenBtn = document.getElementById('mark-green-btn');
    const markRedBtn = document.getElementById('mark-red-btn');
    const noteInput = document.getElementById('note-input');
    const saveNoteBtn = document.getElementById('save-note-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');

    // Новые элементы для выбора пользователя администратором
    const adminSelectUserBtn = document.getElementById('admin-select-user-btn');
    const adminUserSelectionModal = document.getElementById('admin-user-selection-modal');
    const userListContainer = document.getElementById('user-list-container');
    const closeUserSelectionModalBtn = document.getElementById('close-user-selection-modal-btn');

    let isAdmin = false; // По умолчанию пользователь не администратор
    let currentUserId = null; // Будет хранить Telegram User ID
    let dialogs = []; // Диалоги теперь будут загружаться из Firebase
    let currentDialog = null; // Текущий открытый диалог
    let unsubscribeFromDialogs = null; // Для отписки от предыдущего слушателя Firebase

    // Firebase configuration
    const firebaseConfig = {
        apiKey: "AIzaSyDCD5MSC1-hFrXK2JD-rAkjbM4DmBTaYAo",
        authDomain: "koworking-5a698.firebaseapp.com",
        databaseURL: "https://koworking-5a698-default-rtdb.firebaseio.com",
        projectId: "koworking-5a698",
        storageBucket: "koworking-5a698.firebasestorage.app",
        messagingSenderId: "600778210650",
        appId: "1:600778210650:web:e855c57d25895fade4c763",
        measurementId: "G-HQFE1Z2JRQ"
    };

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const database = getDatabase(app);

    const saveDialogs = () => {
        if (currentUserId) {
            set(ref(database, 'users/' + currentUserId + '/dialogs'), dialogs)
                .then(() => {
                    console.log('Диалоги сохранены в Firebase:', dialogs);
                })
                .catch(error => {
                    console.error('Ошибка при сохранении диалогов в Firebase:', error);
                });
        } else {
            console.warn('Не удалось сохранить диалоги: User ID не определен.');
        }
    };

    // Загрузка ID администраторов из admin.json
    fetch('admin.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(adminIds => {
            // Проверка, что Telegram Web App доступен и user.id существует
            if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
                currentUserId = Telegram.WebApp.initDataUnsafe.user.id;
                isAdmin = adminIds.includes(currentUserId);
                console.log(`Пользователь ID: ${currentUserId}, является администратором: ${isAdmin}`); // Логирование статуса администратора
                
                // Если пользователь администратор, показать кнопку выбора пользователя
                if (isAdmin) {
                    adminSelectUserBtn.classList.remove('hidden');
                }

                // После получения currentUserId, загружаем диалоги из Firebase
                if (currentUserId) {
                    // Если есть существующая подписка, отменяем ее
                    if (unsubscribeFromDialogs) {
                        unsubscribeFromDialogs();
                    }
                    const userDialogsRef = ref(database, 'users/' + currentUserId + '/dialogs');
                    unsubscribeFromDialogs = onValue(userDialogsRef, (snapshot) => {
                        const data = snapshot.val();
                        dialogs = data ? data : [];
                        console.log('Диалоги загружены из Firebase:', dialogs); // Логирование загрузки
                        renderDialogs(); // Обновляем отображение после загрузки
                    }, (error) => {
                        console.error('Ошибка при загрузке диалогов из Firebase:', error);
                        dialogs = []; // Сброс диалогов в случае ошибки
                        renderDialogs();
                    });
                }

            } else {
                console.warn('Telegram Web App или user ID недоступны. Режим администратора отключен и диалоги не будут загружены из Firebase.');
                // Если Telegram User ID недоступен, мы не можем загрузить диалоги для конкретного пользователя
                renderDialogs(); // Рендерим пустой список диалогов
            }
        })
        .catch(error => {
            console.error('Ошибка при загрузке admin.json:', error);
            // В случае ошибки загрузки admin.json, isAdmin остается false
            renderDialogs(); // Рендерим диалоги, даже если admin.json не загружен
        });

    // Переменные для отслеживания долгого нажатия
    let pressTimer;
    const longPressDuration = 500; // milliseconds

    // Функции для управления экранами с анимацией
    const showChatListScreen = () => {
        // Чат уходит вправо
        chatScreen.classList.remove('active');
        chatScreen.classList.add('inactive-right');

        // Список чатов появляется на месте
        chatListScreen.classList.remove('inactive-left', 'inactive-right');
        chatListScreen.classList.add('active');
    };

    const showChatScreen = () => {
        // Список чатов уходит влево
        chatListScreen.classList.remove('active');
        chatListScreen.classList.add('inactive-left');

        // Чат появляется на месте
        chatScreen.classList.remove('inactive-left', 'inactive-right');
        chatScreen.classList.add('active');
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return 'Вчера, ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays <= 7) {
            return date.toLocaleDateString('ru-RU', { weekday: 'short' }) + ', ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
    };

    const renderMessages = () => {
        messagesContainer.innerHTML = '';
        if (!currentDialog) return;

        currentDialog.messages.forEach((message, index) => {
            const messageBubble = document.createElement('div');
            messageBubble.classList.add('message-bubble');
            messageBubble.dataset.messageIndex = index; // Добавляем индекс сообщения

            // Используем свойство position из объекта сообщения
            messageBubble.classList.add(message.position);

            // Добавляем классы для цвета, если они есть
            if (message.color) {
                messageBubble.classList.add(message.color);
            }

            let messageContent = `
                ${message.text}
                <span class="message-info">${message.sender}, ${formatDate(message.timestamp)}</span>
            `;

            // Добавляем пометку, если она есть
            if (message.note) {
                messageContent += `<span class="note-content">Пометка: ${message.note}</span>`;
            }

            messageBubble.innerHTML = messageContent;
            messagesContainer.appendChild(messageBubble);
        });
        messagesContainer.scrollTop = messagesContainer.scrollHeight; // Прокрутка вниз
    };

    const openChat = (dialogId) => {
        currentDialog = dialogs.find(d => d.id === dialogId);
        if (currentDialog) {
            chatTitle.textContent = `${currentDialog.participant1} и ${currentDialog.participant2}`;
            showChatScreen(); // Показать экран чата с анимацией
            renderMessages();
        }
    };

    const renderDialogs = () => {
        chatList.innerHTML = '';
        if (dialogs.length === 0) {
            noDialogsMessage.classList.remove('hidden'); // Показать сообщение
        } else {
            noDialogsMessage.classList.add('hidden'); // Скрыть сообщение
            dialogs.forEach((dialog) => {
                const dialogItem = document.createElement('div');
                dialogItem.classList.add('chat-list-item');
                dialogItem.innerHTML = `
                    <h2>${dialog.participant1} и ${dialog.participant2}</h2>
                    <p>Последнее сообщение: ${dialog.messages.length > 0 ? dialog.messages[dialog.messages.length - 1].text : 'Нет сообщений'}</p>
                `;
                dialogItem.addEventListener('click', () => {
                    openChat(dialog.id);
                });
                chatList.appendChild(dialogItem);
            });
        }
    };

    // Обновляем обработчик для кнопки 'Новый диалог'
    newDialogBtn.addEventListener('click', () => {
        newDialogModal.classList.remove('hidden-modal');
        newDialogModal.classList.add('show-modal');
        participant1Input.value = ''; // Очищаем поля
        participant2Input.value = '';
    });

    // Обработчик для кнопки 'Создать' в новом модальном окне
    createNewDialogBtn.addEventListener('click', () => {
        const participant1 = participant1Input.value.trim();
        const participant2 = participant2Input.value.trim();

        if (!participant1 || !participant2) {
            alert('Пожалуйста, введите имена обоих участников.');
            return;
        }

        const newDialog = {
            id: Date.now(),
            participant1: participant1,
            participant2: participant2,
            messages: []
        };
        dialogs.push(newDialog);
        saveDialogs();
        renderDialogs();
        console.log('Создан новый диалог:', newDialog); // Логирование создания
        // Закрываем модальное окно
        newDialogModal.classList.remove('show-modal');
        newDialogModal.classList.add('hidden-modal');
    });

    // Обработчик для кнопки 'Отмена' в новом модальном окне
    cancelNewDialogBtn.addEventListener('click', () => {
        newDialogModal.classList.remove('show-modal');
        newDialogModal.classList.add('hidden-modal');
    });

    sendMessageBtn.addEventListener('click', () => {
        const text = messageInput.value.trim();
        if (text && currentDialog) {
            const newMessage = {
                sender: currentDialog.participant1, // Предполагаем, что отправляет всегда первый участник
                text: text,
                timestamp: new Date().toISOString(),
                color: null, // Добавляем новое свойство
                note: null,   // Добавляем новое свойство
                position: 'right' // Отправленное сообщение всегда справа
            };
            currentDialog.messages.push(newMessage);
            saveDialogs();
            renderMessages();
            console.log('Отправлено новое сообщение:', newMessage); // Логирование отправки
            messageInput.value = '';
        }
    });

    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessageBtn.click();
        }
    });

    backButton.addEventListener('click', () => {
        currentDialog = null;
        showChatListScreen(); // Показать список чатов с анимацией
        renderDialogs(); // Обновить список диалогов, чтобы показать последнее сообщение
    });

    moreOptionsButton.addEventListener('click', (event) => {
        event.stopPropagation(); // Предотвратить закрытие при клике по кнопке
        optionsMenu.classList.toggle('show-menu');
        optionsMenu.classList.toggle('hidden-menu');
    });

    // Закрытие меню при клике вне его
    document.addEventListener('click', (event) => {
        if (!optionsMenu.contains(event.target) && !moreOptionsButton.contains(event.target)) {
            if (optionsMenu.classList.contains('show-menu')) {
                optionsMenu.classList.remove('show-menu');
                optionsMenu.classList.add('hidden-menu');
            }
        }
    });

    importMessagesBtn.addEventListener('click', () => {
        optionsMenu.classList.remove('show-menu');
        optionsMenu.classList.add('hidden-menu');

        importModal.classList.remove('hidden-modal');
        importModal.classList.add('show-modal');
    });

    closeModalBtn.addEventListener('click', () => {
        importModal.classList.remove('show-modal');
        importModal.classList.add('hidden-modal');
        telegramDialogInput.value = ''; // Очистить поле ввода
    });

    processImportBtn.addEventListener('click', () => {
        const telegramText = telegramDialogInput.value;
        if (telegramText && currentDialog) {
            const parsedMessages = parseTelegramMessages(telegramText, currentDialog.participant1, currentDialog.participant2);
            currentDialog.messages = [...currentDialog.messages, ...parsedMessages.map(msg => ({
                ...msg, // Копируем существующие свойства
                position: msg.sender === currentDialog.participant1 ? 'right' : 'left' // Добавляем позицию
            }))];
            saveDialogs();
            renderMessages();
            console.log('Сообщения импортированы:', parsedMessages); // Логирование импорта
            closeModalBtn.click(); // Закрыть модальное окно после импорта
        } else if (!currentDialog) {
            alert('Сначала выберите диалог для импорта сообщений.');
        }
    });

    // Добавление обработчиков для долгого нажатия / ПКМ
    let selectedMessage = null; // Переменная для хранения ссылки на выбранное сообщение

    // Начало новых функций парсинга Telegram
    function parseTelegramMessages(inputText, participant1, participant2) {
        const messages = [];
        // Регулярное выражение для разбора строки с отправителем и датой
        const headerRegex = /^([^,]+?),\s*\[(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2})\]\s*$/;
        
        // Временные переменные для сборки сообщения
        let currentSender = null;
        let currentDate = null;
        let currentLines = [];
        
        const lines = inputText.split('\n');
        let isFirstMessage = true;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Пропускаем пустые строки перед первым сообщением
            if (isFirstMessage && !line) continue;
            
            const match = line.match(headerRegex);
            
            if (match) {
                // Сохраняем предыдущее сообщение (если есть)
                if (currentSender !== null) {
                    messages.push(createMessage(
                        currentSender,
                        currentDate,
                        currentLines,
                        participant1,
                        participant2
                    ));
                }
                
                // Начинаем новое сообщение
                currentSender = match[1].trim();
                currentDate = parseDate(match[2].trim());
                currentLines = [];
                isFirstMessage = false;
                continue;
            }
            
            // Добавляем текст к текущему сообщению
            if (currentSender !== null && line) {
                currentLines.push(line);
            }
        }
        
        // Добавляем последнее сообщение
        if (currentSender !== null) {
            messages.push(createMessage(
                currentSender,
                currentDate,
                currentLines,
                participant1,
                participant2
            ));
        }
        
        return messages;
    }

    function parseDate(dateString) {
        const [datePart, timePart] = dateString.split(' ');
        const [day, month, year] = datePart.split('.').map(Number);
        const [hours, minutes] = timePart.split(':').map(Number);
        
        // Валидация даты
        if (
            day > 31 || month > 12 || 
            hours > 23 || minutes > 59 ||
            isNaN(day) || isNaN(month) || isNaN(year)
        ) {
            console.warn('Некорректная дата:', dateString, 'Возвращена текущая дата.');
            return new Date(); // Возвращаем текущую дату при ошибке
        }
        
        return new Date(year, month - 1, day, hours, minutes);
    }

    function createMessage(sender, date, lines, p1, p2) {
        // Обработка многострочных сообщений
        let text = lines.join('\n').trim();
        
        // Удаление лишних переносов в конце, если они есть
        if (text.endsWith('\n')) {
            text = text.slice(0, -1);
        }
        
        return {
            sender,
            text,
            timestamp: date.toISOString(), // Преобразуем Date в ISO-строку для хранения
            color: null,
            note: null,
            position: sender.toLowerCase() === p1.toLowerCase() ? 'right' : sender.toLowerCase() === p2.toLowerCase() ? 'left' : 'unknown'
        };
    }
    // Конец новых функций парсинга Telegram

    // Добавляем обработчик для кнопки удаления диалога
    const deleteDialogBtn = document.getElementById('delete-dialog-btn');
    deleteDialogBtn.addEventListener('click', () => {
        if (currentDialog && confirm('Вы уверены, что хотите удалить этот диалог?')) {
            dialogs = dialogs.filter(d => d.id !== currentDialog.id);
            saveDialogs();
            currentDialog = null;
            showChatListScreen();
            renderDialogs();
            console.log('Диалог удален.'); // Логирование удаления
            optionsMenu.classList.remove('show-menu');
            optionsMenu.classList.add('hidden-menu');
        }
    });

    // Закрытие меню редактирования сообщения
    const hideMessageEditor = () => {
        messageEditorMenu.classList.remove('show-menu');
        messageEditorMenu.classList.add('hidden-menu');
        selectedMessage = null;
        noteInput.value = ''; // Очищаем поле пометки
    };

    // Открытие меню редактирования сообщения с заданием позиции
    const showMessageEditor = (message, x, y) => {
        if (!isAdmin) { // Проверяем, является ли пользователь администратором
            return; // Если нет, просто выходим
        }

        selectedMessage = message;
        noteInput.value = message.note || '';
        messageEditorMenu.classList.remove('hidden-menu');
        messageEditorMenu.classList.add('show-menu');

        // Всегда позиционируем меню по центру экрана
        messageEditorMenu.style.left = '50%';
        messageEditorMenu.style.top = '50%';
        messageEditorMenu.style.transform = 'translate(-50%, -50%)'; // Центрируем по обоим осям
        messageEditorMenu.style.bottom = 'auto'; // Сбрасываем, если было установлено

        // Добавляем закрытие меню редактирования, если клик был вне его
        if (!messageEditorMenu.contains(event.target) && !event.target.closest('.message-bubble')) {
            if (messageEditorMenu.classList.contains('show-menu')) {
                hideMessageEditor();
            }
        }
    };

    // Долгое нажатие на сообщение (для мобильных устройств)
    messagesContainer.addEventListener('mousedown', (e) => {
        const messageBubble = e.target.closest('.message-bubble');
        if (messageBubble && e.button === 0 && isAdmin) { // Только левая кнопка мыши и проверка isAdmin
            // Предотвращаем выделение текста при долгом нажатии
            e.preventDefault();
            clearTimeout(pressTimer);
            pressTimer = setTimeout(() => {
                const messageIndex = parseInt(messageBubble.dataset.messageIndex);
                const message = currentDialog.messages[messageIndex];
                showMessageEditor(message);
            }, longPressDuration);
        }
    });

    messagesContainer.addEventListener('mouseup', () => {
        clearTimeout(pressTimer);
    });

    messagesContainer.addEventListener('mouseleave', () => {
        clearTimeout(pressTimer);
    });

    // Для мобильных устройств (touch events)
    messagesContainer.addEventListener('touchstart', (e) => {
        const messageBubble = e.target.closest('.message-bubble');
        if (messageBubble && isAdmin) { // Проверка isAdmin
            e.preventDefault(); // Предотвращаем стандартное поведение скролла
            clearTimeout(pressTimer);
            pressTimer = setTimeout(() => {
                const messageIndex = parseInt(messageBubble.dataset.messageIndex);
                const message = currentDialog.messages[messageIndex];
                showMessageEditor(message);
            }, longPressDuration);
        }
    });

    messagesContainer.addEventListener('touchend', () => {
        clearTimeout(pressTimer);
    });

    messagesContainer.addEventListener('touchcancel', () => {
        clearTimeout(pressTimer);
    });

    // Добавляем обработчик для правой кнопки мыши (ПК)
    messagesContainer.addEventListener('contextmenu', (e) => {
        const messageBubble = e.target.closest('.message-bubble');
        if (messageBubble && isAdmin) { // Проверка isAdmin
            e.preventDefault(); // Отключаем стандартное контекстное меню
            clearTimeout(pressTimer); // Отменяем таймер долгого нажатия, если он активен

            const messageIndex = parseInt(messageBubble.dataset.messageIndex);
            const message = currentDialog.messages[messageIndex];

            // Позиционируем меню относительно курсора
            showMessageEditor(message, e.clientX, e.clientY);
        }
    });

    // Обработчики кнопок меню редактирования
    markGreenBtn.addEventListener('click', () => {
        if (selectedMessage) {
            selectedMessage.color = 'green';
            saveDialogs();
            renderMessages();
            hideMessageEditor();
        }
    });

    markRedBtn.addEventListener('click', () => {
        if (selectedMessage) {
            selectedMessage.color = 'red';
            saveDialogs();
            renderMessages();
            hideMessageEditor();
        }
    });

    saveNoteBtn.addEventListener('click', () => {
        if (selectedMessage) {
            selectedMessage.note = noteInput.value.trim();
            saveDialogs();
            renderMessages();
            hideMessageEditor();
        }
    });

    cancelEditBtn.addEventListener('click', () => {
        hideMessageEditor();
    });

    // Функция для загрузки диалогов выбранного пользователя (для админа)
    const loadSelectedUserDialogs = (userIdToLoad) => {
        if (unsubscribeFromDialogs) {
            unsubscribeFromDialogs(); // Отписываемся от предыдущего слушателя
        }

        currentUserId = userIdToLoad; // Обновляем текущего пользователя на выбранного админом
        const userDialogsRef = ref(database, 'users/' + userIdToLoad + '/dialogs');
        unsubscribeFromDialogs = onValue(userDialogsRef, (snapshot) => {
            const data = snapshot.val();
            dialogs = data ? data : [];
            console.log(`Диалоги для пользователя ${userIdToLoad} загружены из Firebase:`, dialogs); // Логирование загрузки
            renderDialogs(); // Обновляем отображение после загрузки
            showChatListScreen(); // Возвращаемся к списку чатов
            adminUserSelectionModal.classList.remove('show-modal');
            adminUserSelectionModal.classList.add('hidden-modal');
        }, (error) => {
            console.error(`Ошибка при загрузке диалогов для пользователя ${userIdToLoad} из Firebase:`, error);
            dialogs = []; // Сброс диалогов в случае ошибки
            renderDialogs();
        });
    };

    // Открытие модального окна выбора пользователя для админа
    const openUserSelectionModal = () => {
        userListContainer.innerHTML = '<p>Загрузка пользователей...</p>';
        adminUserSelectionModal.classList.remove('hidden-modal');
        adminUserSelectionModal.classList.add('show-modal');

        const usersRef = ref(database, 'users');
        onValue(usersRef, (snapshot) => {
            const usersData = snapshot.val();
            userListContainer.innerHTML = ''; // Очищаем список
            if (usersData) {
                Object.keys(usersData).forEach(userId => {
                    const userItem = document.createElement('div');
                    userItem.classList.add('user-list-item');
                    userItem.textContent = `Пользователь: ${userId}`;
                    userItem.dataset.userId = userId;
                    userItem.addEventListener('click', () => loadSelectedUserDialogs(userId));
                    userListContainer.appendChild(userItem);
                });
            } else {
                userListContainer.innerHTML = '<p>Пользователи не найдены.</p>';
            }
        }, (error) => {
            console.error('Ошибка при загрузке списка пользователей:', error);
            userListContainer.innerHTML = '<p>Ошибка загрузки пользователей.</p>';
        }, { onlyOnce: true }); // Загружаем список пользователей только один раз при открытии модального окна
    };

    // Обработчик кнопки выбора пользователя (для админа)
    adminSelectUserBtn.addEventListener('click', () => {
        if (isAdmin) {
            openUserSelectionModal();
            optionsMenu.classList.remove('show-menu');
            optionsMenu.classList.add('hidden-menu');
        }
    });

    // Обработчик кнопки закрытия модального окна выбора пользователя
    closeUserSelectionModalBtn.addEventListener('click', () => {
        adminUserSelectionModal.classList.remove('show-modal');
        adminUserSelectionModal.classList.add('hidden-modal');

        // После закрытия модального окна, если мы не смотрим как админ, возвращаем диалоги текущего пользователя
        // Это может быть необходимо, если админ открыл модалку, но не выбрал другого пользователя
        // или если он хочет вернуться к своим диалогам
        if (currentUserId && !isAdmin) { // Проверяем, что не админ и что есть текущий ID
             // Если исходный пользователь не админ, и мы были в режиме просмотра админа, 
             // то возвращаем диалоги исходного пользователя
             const userDialogsRef = ref(database, 'users/' + Telegram.WebApp.initDataUnsafe.user.id + '/dialogs');
             if (unsubscribeFromDialogs) {
                 unsubscribeFromDialogs();
             }
             unsubscribeFromDialogs = onValue(userDialogsRef, (snapshot) => {
                 const data = snapshot.val();
                 dialogs = data ? data : [];
                 console.log('Возвращены диалоги текущего пользователя:', dialogs);
                 renderDialogs();
             }, (error) => {
                 console.error('Ошибка при возвращении диалогов текущего пользователя:', error);
             });
        } else if (currentUserId && isAdmin) {
            // Если админ закрыл модалку, но остается админом, и смотрит свои диалоги
            // или диалоги какого-то другого пользователя, оставляем как есть
            renderDialogs();
        }
    });

    // Инициализация при загрузке страницы
    renderDialogs();
    // showChatListScreen(); // Убеждаемся, что список чатов виден при загрузке - этот вызов теперь не нужен, так как первый экран уже активен по умолчанию в index.html
});
