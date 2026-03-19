document.addEventListener('DOMContentLoaded', () => {
    const terminalsContainer = document.querySelector('.terminals-container');
    if (terminalsContainer) {
        initialTerminalsMarkup = terminalsContainer.innerHTML;
    }

    initTaskCards();
    initTerminalTabs();
    initButtons();
    initDropdown();

    const activeCard = document.querySelector('.task-card.active');
    if (activeCard?.dataset.taskId) {
        activeTaskId = activeCard.dataset.taskId;
        saveTaskState(activeTaskId);
    }
});

const tabContentState = new Map();
const taskTerminalState = new Map();
let tabCounter = 0;
let currentDropdownTerminal = null;
let activeTaskId = null;
let initialTerminalsMarkup = '';

function createTabId() {
    tabCounter += 1;
    return `tab-${Date.now()}-${tabCounter}`;
}

function ensureTerminalId(terminal, force = false) {
    if (force || !terminal.dataset.terminalId) {
        terminal.dataset.terminalId = `terminal-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }
}

function ensureTabId(tab) {
    if (!tab.dataset.tabId) {
        tab.dataset.tabId = createTabId();
    }
    return tab.dataset.tabId;
}

function getTabs(terminal) {
    return Array.from(terminal.querySelectorAll('.terminal-tab:not(.new-tab-btn)'));
}

function getActiveTab(terminal) {
    return terminal.querySelector('.terminal-tab.active:not(.new-tab-btn)');
}

function getTerminalOutput(terminal) {
    return terminal.querySelector('.terminal-view .terminal-output');
}

function ensureCloseButton(tab, terminal) {
    const tabContent = tab.querySelector('.tab-content');
    if (!tabContent || tabContent.querySelector('.close-btn')) return;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'icon-btn close-btn';
    closeBtn.innerHTML = '<img src="assets/icon-close.svg" alt="Close" class="icon">';
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeTab(tab, terminal);
    });
    tabContent.appendChild(closeBtn);
}

function renderTerminalOutput(terminal) {
    const output = getTerminalOutput(terminal);
    if (!output) return;

    const activeTab = getActiveTab(terminal);
    if (!activeTab) {
        output.textContent = '';
        output.contentEditable = 'false';
        return;
    }

    const tabId = ensureTabId(activeTab);
    if (!tabContentState.has(tabId)) {
        tabContentState.set(tabId, '');
    }

    output.textContent = tabContentState.get(tabId);
    output.contentEditable = 'true';
    output.spellcheck = false;
}

function setActiveTab(terminal, tab) {
    const tabs = getTabs(terminal);
    tabs.forEach((t) => {
        t.classList.remove('active');
        const closeBtn = t.querySelector('.close-btn');
        if (closeBtn) closeBtn.remove();
    });

    tab.classList.add('active');
    ensureCloseButton(tab, terminal);
    renderTerminalOutput(terminal);
}

function bindTerminalOutput(terminal) {
    const output = getTerminalOutput(terminal);
    if (!output || output.dataset.inputBound === 'true') return;

    output.dataset.inputBound = 'true';
    output.addEventListener('input', () => {
        const activeTab = getActiveTab(terminal);
        if (!activeTab) return;

        const tabId = ensureTabId(activeTab);
        tabContentState.set(tabId, output.textContent);
    });
}

function captureInitialTabState(terminal) {
    const tabs = getTabs(terminal);
    const output = getTerminalOutput(terminal);
    const initialOutput = output ? output.textContent : '';
    const activeTab = getActiveTab(terminal);

    tabs.forEach((tab) => {
        const tabId = ensureTabId(tab);
        if (!tabContentState.has(tabId)) {
            tabContentState.set(tabId, tab === activeTab ? initialOutput : '');
        }
    });

    renderTerminalOutput(terminal);
}

function bindTabEvents(tab, terminal) {
    tab.addEventListener('click', (e) => {
        if (e.target.closest('.close-btn')) return;
        setActiveTab(terminal, tab);
    });

    const closeBtn = tab.querySelector('.close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeTab(tab, terminal);
        });
    }
}

function getTaskCardById(taskId) {
    return document.querySelector(`.task-card[data-task-id="${taskId}"]`);
}

function extractAgentsFromTerminalsRoot(root) {
    if (!root) return [];

    const tabs = Array.from(root.querySelectorAll('.terminal-tab:not(.new-tab-btn)'));
    return tabs.map((tab) => {
        const title = tab.querySelector('.tab-title')?.textContent?.trim() || 'Engineer';
        const statusEl = tab.querySelector('.status');
        const isRunning = statusEl?.classList.contains('running');

        return {
            name: title,
            status: isRunning ? 'running' : 'idle'
        };
    });
}

function renderAgentsList(card, agents) {
    const agentsList = card.querySelector('.agents-list');
    if (!agentsList) return;

    agentsList.innerHTML = '';
    agents.forEach((agent) => {
        const row = document.createElement('div');
        row.className = 'agent-row';
        row.innerHTML = `
            <span class="agent-name">${agent.name}</span>
            <div class="status ${agent.status}">
                <img src="assets/${agent.status === 'running' ? 'ellipse-running.svg' : 'ellipse-idle.svg'}" alt="" class="status-dot">
                <span class="status-text">${agent.status === 'running' ? 'Running' : 'Idle'}</span>
            </div>
        `;
        agentsList.appendChild(row);
    });
}

function renderTaskIndicators(card, agents) {
    const indicators = card.querySelector('.task-indicators');
    if (!indicators) return;

    indicators.innerHTML = '';
    agents.forEach((agent) => {
        const dot = document.createElement('img');
        dot.className = 'status-dot';
        dot.src = `assets/${agent.status === 'running' ? 'ellipse-running.svg' : 'ellipse-idle.svg'}`;
        dot.alt = '';
        indicators.appendChild(dot);
    });
}

function updateTaskCardFromAgents(taskId, agents) {
    const card = getTaskCardById(taskId);
    if (!card) return;

    renderAgentsList(card, agents);
    renderTaskIndicators(card, agents);
    updateTaskCardView(card, card.classList.contains('active'));
}

function collectAgentsFromCurrentTerminals() {
    const terminalsContainer = document.querySelector('.terminals-container');
    return extractAgentsFromTerminalsRoot(terminalsContainer);
}

function collectAgentsFromMarkup(markup) {
    if (!markup) return [];
    const temp = document.createElement('div');
    temp.innerHTML = markup;
    return extractAgentsFromTerminalsRoot(temp);
}

function persistActiveTaskState() {
    if (!activeTaskId) return;
    saveTaskState(activeTaskId);
}

function serializeCurrentTerminalsState() {
    const terminalsContainer = document.querySelector('.terminals-container');
    if (!terminalsContainer) return null;

    const tabContent = {};
    const tabs = terminalsContainer.querySelectorAll('.terminal-tab:not(.new-tab-btn)');
    tabs.forEach((tab) => {
        const tabId = tab.dataset.tabId;
        if (!tabId) return;
        tabContent[tabId] = tabContentState.get(tabId) || '';
    });

    return {
        markup: terminalsContainer.innerHTML,
        tabContent,
        agents: collectAgentsFromCurrentTerminals()
    };
}

function saveTaskState(taskId) {
    if (!taskId) return;
    const state = serializeCurrentTerminalsState();
    if (!state) return;
    taskTerminalState.set(taskId, state);
    updateTaskCardFromAgents(taskId, state.agents || []);
}

function applyTaskTabContent(tabContent) {
    if (!tabContent) return;
    Object.entries(tabContent).forEach(([tabId, content]) => {
        tabContentState.set(tabId, content);
    });
}

function loadTaskState(taskId) {
    const terminalsContainer = document.querySelector('.terminals-container');
    if (!terminalsContainer || !taskId) return;

    const savedState = taskTerminalState.get(taskId);
    if (savedState) {
        terminalsContainer.innerHTML = savedState.markup;
        applyTaskTabContent(savedState.tabContent);
        initTerminalTabs();
        updateTaskCardFromAgents(taskId, savedState.agents || collectAgentsFromMarkup(savedState.markup));
        return;
    }

    terminalsContainer.innerHTML = initialTerminalsMarkup;
    initTerminalTabs();
    saveTaskState(taskId);
}

function switchToTask(taskId) {
    if (!taskId || taskId === activeTaskId) return;
    const dropdown = document.getElementById('agentDropdown');
    if (dropdown) {
        dropdown.classList.add('hidden');
        currentDropdownTerminal = null;
    }

    if (activeTaskId) {
        saveTaskState(activeTaskId);
    }
    loadTaskState(taskId);
    activeTaskId = taskId;
}

function collapseSplitIfTerminalEmpty(terminal) {
    const wrapper = terminal.closest('.terminal-wrapper');
    if (!wrapper || !wrapper.classList.contains('split')) return false;

    const terminals = Array.from(wrapper.querySelectorAll('.terminal'));
    if (terminals.length <= 1) return false;

    const otherTerminal = terminals.find((t) => t !== terminal);
    if (!otherTerminal) return false;

    terminal.remove();
    wrapper.classList.remove('split');

    const splitIcon = otherTerminal.querySelector('.split-icon');
    if (splitIcon) {
        splitIcon.src = 'assets/icon-split.svg';
    }

    initTerminalTabsForElement(otherTerminal);
    return true;
}

function initDropdown() {
    const dropdown = document.getElementById('agentDropdown');
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.new-tab-btn') && !e.target.closest('.dropdown-menu')) {
            dropdown.classList.add('hidden');
            currentDropdownTerminal = null;
            document.querySelectorAll('.new-tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelectorAll('.terminal-tab.active:not(.new-tab-btn)').forEach(tab => {
                tab.style.backgroundColor = '';
            });
            document.querySelectorAll('.terminal-view').forEach(view => {
                view.style.backgroundColor = '';
            });
        }
    });
    
    dropdown.addEventListener('click', (e) => {
        const item = e.target.closest('.dropdown-item');
        if (item) {
            const agentType = item.dataset.agentType;
            const terminalByRef = currentDropdownTerminal && currentDropdownTerminal.isConnected
                ? currentDropdownTerminal
                : null;
            const terminalById = dropdown.dataset.currentTerminal
                ? document.querySelector(`[data-terminal-id="${dropdown.dataset.currentTerminal}"]`)
                : null;
            const terminalElement = terminalByRef || terminalById;
            if (terminalElement) {
                addNewTabWithType(terminalElement, agentType);
            }
            dropdown.classList.add('hidden');
            currentDropdownTerminal = null;
            document.querySelectorAll('.new-tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelectorAll('.terminal-tab.active:not(.new-tab-btn)').forEach(tab => {
                tab.style.backgroundColor = '';
            });
            document.querySelectorAll('.terminal-view').forEach(view => {
                view.style.backgroundColor = '';
            });
        }
    });
}

function initTaskCards() {
    const taskCards = document.querySelectorAll('.task-card');
    
    taskCards.forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.icon-btn')) return;

            taskCards.forEach(c => {
                c.classList.remove('active');
                c.classList.add('collapsed');
                updateTaskCardView(c, false);
            });

            card.classList.remove('collapsed');
            card.classList.add('active');
            updateTaskCardView(card, true);

            const taskId = card.dataset.taskId;
            if (taskId) {
                switchToTask(taskId);
            }
        });
        
        updateTaskCardView(card, card.classList.contains('active'));
    });
}

function updateTaskCardView(card, isActive) {
    const agentsList = card.querySelector('.agents-list');
    const indicators = card.querySelector('.task-indicators');
    
    if (isActive) {
        if (agentsList) agentsList.style.display = 'flex';
        if (indicators) indicators.style.display = 'none';
    } else {
        if (agentsList) agentsList.style.display = 'none';
        if (indicators) {
            indicators.style.display = 'flex';
            updateIndicatorsFromAgents(card);
        }
    }
}

function initTerminalTabs() {
    const terminals = document.querySelectorAll('.terminal');
    terminals.forEach((terminal) => {
        initTerminalTabsForElement(terminal);
    });
}

function showDropdown(button, terminal) {
    const dropdown = document.getElementById('agentDropdown');
    const rect = button.getBoundingClientRect();

    ensureTerminalId(terminal);
    dropdown.dataset.currentTerminal = terminal.dataset.terminalId;
    currentDropdownTerminal = terminal;
    
    button.classList.add('active');
    
    const activeTab = terminal.querySelector('.terminal-tab.active:not(.new-tab-btn)');
    if (activeTab) {
        activeTab.style.backgroundColor = '#2d2d2d';
    }
    
    const terminalView = terminal.querySelector('.terminal-view');
    if (terminalView) {
        terminalView.style.backgroundColor = '#2d2d2d';
    }
    
    dropdown.classList.remove('hidden');
    dropdown.style.left = rect.left + 'px';
    dropdown.style.top = rect.bottom + 'px';
}

function addNewTabWithType(terminal, agentType) {
    const tabsContainer = terminal.querySelector('.tabs-container');
    const newTabBtn = terminal.querySelector('.new-tab-btn');
    
    const divider = document.createElement('div');
    divider.className = 'divider';
    
    const newTab = document.createElement('div');
    newTab.className = 'terminal-tab active';
    newTab.innerHTML = `
        <div class="tab-content">
            <div class="tab-info">
                <p class="tab-title">${agentType}</p>
                <div class="status idle">
                    <img src="assets/ellipse-idle.svg" alt="" class="status-dot">
                    <span class="status-text">Idle</span>
                </div>
            </div>
            <button class="icon-btn close-btn">
                <img src="assets/icon-close.svg" alt="Close" class="icon">
            </button>
        </div>
    `;
    
    tabsContainer.insertBefore(divider, newTabBtn);
    tabsContainer.insertBefore(newTab, newTabBtn);

    ensureTabId(newTab);
    tabContentState.set(newTab.dataset.tabId, '');
    bindTabEvents(newTab, terminal);
    setActiveTab(terminal, newTab);
    persistActiveTaskState();
}

function addNewTab(terminal) {
    addNewTabWithType(terminal, 'Engineer');
}

function updateIndicatorsFromAgents(card) {
    const agentsList = card.querySelector('.agents-list');
    const indicators = card.querySelector('.task-indicators');
    
    if (!agentsList || !indicators) return;
    
    const agents = agentsList.querySelectorAll('.agent-row');
    indicators.innerHTML = '';
    
    agents.forEach(agent => {
        const statusDiv = agent.querySelector('.status');
        const dot = document.createElement('img');
        dot.className = 'status-dot';
        
        if (statusDiv.classList.contains('running')) {
            dot.src = 'assets/ellipse-running.svg';
        } else {
            dot.src = 'assets/ellipse-idle.svg';
        }
        
        indicators.appendChild(dot);
    });
}

function initButtons() {
    const splitBtns = document.querySelectorAll('.split-btn');
    
    splitBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const terminalWrapper = btn.closest('.terminal-wrapper');
            toggleSplitView(terminalWrapper);
        });
    });
}

function toggleSplitView(wrapper) {
    if (wrapper.classList.contains('split')) {
        const terminals = wrapper.querySelectorAll('.terminal');
        if (terminals.length > 1) {
            const leftTerminal = terminals[0];
            const rightTerminal = terminals[1];
            
            const rightTabs = Array.from(rightTerminal.querySelectorAll('.terminal-tab:not(.new-tab-btn)'));
            const leftTabsContainer = leftTerminal.querySelector('.tabs-container');
            const leftNewTabBtn = leftTerminal.querySelector('.new-tab-btn');
            
            rightTabs.forEach(tab => {
                const divider = document.createElement('div');
                divider.className = 'divider';
                leftTabsContainer.insertBefore(divider, leftNewTabBtn);
                leftTabsContainer.insertBefore(tab.cloneNode(true), leftNewTabBtn);
            });
            
            rightTerminal.remove();
            wrapper.classList.remove('split');
            
            const splitIcon = leftTerminal.querySelector('.split-icon');
            if (splitIcon) {
                splitIcon.src = 'assets/icon-split.svg';
            }
            
            initTerminalTabsForElement(leftTerminal);
            persistActiveTaskState();
        }
    } else {
        const existingTerminal = wrapper.querySelector('.terminal');
        const tabs = Array.from(existingTerminal.querySelectorAll('.terminal-tab:not(.new-tab-btn)'));
        
        if (tabs.length <= 1) return;
        
        const activeTab = tabs.find(t => t.classList.contains('active')) || tabs[0];
        if (activeTab) {
            setActiveTab(existingTerminal, activeTab);
        }
        
        const leftTerminal = existingTerminal.cloneNode(true);
        const rightTerminal = existingTerminal.cloneNode(true);
        
        wrapper.innerHTML = '';
        
        const leftTabsContainer = leftTerminal.querySelector('.tabs-container');
        const leftAllTabs = Array.from(leftTabsContainer.querySelectorAll('.terminal-tab:not(.new-tab-btn)'));
        const leftDividers = Array.from(leftTabsContainer.querySelectorAll('.divider'));
        
        leftAllTabs.forEach(tab => {
            if (!tab.classList.contains('active')) {
                tab.remove();
            }
        });
        leftDividers.forEach(div => div.remove());
        
        const rightTabsContainer = rightTerminal.querySelector('.tabs-container');
        const rightAllTabs = Array.from(rightTabsContainer.querySelectorAll('.terminal-tab:not(.new-tab-btn)'));
        const rightDividers = Array.from(rightTabsContainer.querySelectorAll('.divider'));
        
        const activeTabInRight = rightAllTabs.find(t => t.classList.contains('active'));
        if (activeTabInRight) {
            activeTabInRight.remove();
        }
        
        rightDividers.forEach((div, index) => {
            if (index === 0) div.remove();
        });
        
        const remainingRightTabs = rightTerminal.querySelectorAll('.terminal-tab:not(.new-tab-btn)');
        if (remainingRightTabs.length > 0) {
            remainingRightTabs[0].classList.add('active');
        }
        
        const rightSplitIcon = rightTerminal.querySelector('.split-icon');
        if (rightSplitIcon) {
            rightSplitIcon.src = 'assets/icon-split-active.svg';
        }
        
        wrapper.appendChild(leftTerminal);
        wrapper.appendChild(rightTerminal);
        wrapper.classList.add('split');
        
        initTerminalTabsForElement(leftTerminal);
        initTerminalTabsForElement(rightTerminal);
        persistActiveTaskState();
    }
}

function removeTab(tab, terminal) {
    const wasActive = tab.classList.contains('active');
    const tabId = tab.dataset.tabId;
    
    const prevElement = tab.previousElementSibling;
    const nextElement = tab.nextElementSibling;
    
    if (prevElement && prevElement.classList.contains('divider')) {
        prevElement.remove();
    } else if (nextElement && nextElement.classList.contains('divider')) {
        nextElement.remove();
    }
    
    tab.remove();
    if (tabId) {
        tabContentState.delete(tabId);
    }
    
    const remainingTabs = terminal.querySelectorAll('.terminal-tab:not(.new-tab-btn)');
    if (remainingTabs.length === 0) {
        if (collapseSplitIfTerminalEmpty(terminal)) {
            persistActiveTaskState();
            return;
        }
        renderTerminalOutput(terminal);
        persistActiveTaskState();
        return;
    }

    if (wasActive || !getActiveTab(terminal)) {
        setActiveTab(terminal, remainingTabs[0]);
    } else {
        renderTerminalOutput(terminal);
    }
    persistActiveTaskState();
}

function initTerminalTabsForElement(terminal) {
    ensureTerminalId(terminal, true);
    bindTerminalOutput(terminal);

    const tabs = terminal.querySelectorAll('.terminal-tab:not(.new-tab-btn)');
    tabs.forEach((tab) => {
        const newTab = tab.cloneNode(true);
        tab.parentNode.replaceChild(newTab, tab);
        ensureTabId(newTab);
        bindTabEvents(newTab, terminal);
    });

    const newTabBtn = terminal.querySelector('.new-tab-btn');
    if (newTabBtn) {
        const newBtn = newTabBtn.cloneNode(true);
        newTabBtn.parentNode.replaceChild(newBtn, newTabBtn);

        newBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showDropdown(newBtn, terminal);
        });
    }

    const splitBtn = terminal.querySelector('.split-btn');
    if (splitBtn) {
        const newBtn = splitBtn.cloneNode(true);
        splitBtn.parentNode.replaceChild(newBtn, splitBtn);

        newBtn.addEventListener('click', () => {
            const wrapper = terminal.closest('.terminal-wrapper');
            toggleSplitView(wrapper);
        });
    }

    captureInitialTabState(terminal);
}
