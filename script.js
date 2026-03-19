document.addEventListener('DOMContentLoaded', () => {
    initTaskCards();
    initTerminalTabs();
    initButtons();
    initDropdown();
});

function initDropdown() {
    const dropdown = document.getElementById('agentDropdown');
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.new-tab-btn') && !e.target.closest('.dropdown-menu')) {
            dropdown.classList.add('hidden');
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
            const terminal = dropdown.dataset.currentTerminal;
            if (terminal) {
                const terminalElement = document.querySelector(`[data-terminal-id="${terminal}"]`);
                if (terminalElement) {
                    addNewTabWithType(terminalElement, agentType);
                }
            }
            dropdown.classList.add('hidden');
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
            
            const wasActive = card.classList.contains('active');
            
            taskCards.forEach(c => {
                c.classList.remove('active');
                c.classList.add('collapsed');
                updateTaskCardView(c, false);
            });
            
            if (!wasActive) {
                card.classList.remove('collapsed');
                card.classList.add('active');
                updateTaskCardView(card, true);
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
    
    terminals.forEach(terminal => {
        const tabs = terminal.querySelectorAll('.terminal-tab:not(.new-tab-btn)');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                if (e.target.closest('.close-btn')) return;
                
                tabs.forEach(t => {
                    t.classList.remove('active');
                    const closeBtn = t.querySelector('.close-btn');
                    if (closeBtn) closeBtn.remove();
                });
                
                tab.classList.add('active');
                
                const tabContent = tab.querySelector('.tab-content');
                if (tabContent && !tabContent.querySelector('.close-btn')) {
                    const closeBtn = document.createElement('button');
                    closeBtn.className = 'icon-btn close-btn';
                    closeBtn.innerHTML = '<img src="assets/icon-close.svg" alt="Close" class="icon">';
                    closeBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        removeTab(tab, terminal);
                    });
                    tabContent.appendChild(closeBtn);
                }
            });
        });
        
        const closeBtns = terminal.querySelectorAll('.close-btn');
        closeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tab = btn.closest('.terminal-tab');
                const wasActive = tab.classList.contains('active');
                
                const prevDivider = tab.previousElementSibling;
                if (prevDivider && prevDivider.classList.contains('divider')) {
                    prevDivider.remove();
                }
                
                tab.remove();
                
                if (wasActive) {
                    const remainingTabs = terminal.querySelectorAll('.terminal-tab:not(.new-tab-btn)');
                    if (remainingTabs.length > 0) {
                        remainingTabs[0].classList.add('active');
                    }
                }
            });
        });
        
        const newTabBtn = terminal.querySelector('.new-tab-btn');
        if (newTabBtn) {
            newTabBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showDropdown(e.currentTarget, terminal);
            });
        }
    });
}

function showDropdown(button, terminal) {
    const dropdown = document.getElementById('agentDropdown');
    const rect = button.getBoundingClientRect();
    
    if (!terminal.dataset.terminalId) {
        terminal.dataset.terminalId = 'terminal-' + Date.now();
    }
    dropdown.dataset.currentTerminal = terminal.dataset.terminalId;
    
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
    
    const allTabs = terminal.querySelectorAll('.terminal-tab:not(.new-tab-btn)');
    allTabs.forEach(t => {
        t.classList.remove('active');
        const closeBtn = t.querySelector('.close-btn');
        if (closeBtn) closeBtn.remove();
    });
    
    const divider = document.createElement('div');
    divider.className = 'divider';
    
    const newTab = document.createElement('div');
    newTab.className = 'terminal-tab active';
    newTab.innerHTML = `
        <div class="tab-content">
            <div class="tab-info">
                <p class="tab-title">${agentType}</p>
                <div class="status running">
                    <img src="assets/ellipse-running.svg" alt="" class="status-dot">
                    <span class="status-text">Running</span>
                </div>
            </div>
            <button class="icon-btn close-btn">
                <img src="assets/icon-close.svg" alt="Close" class="icon">
            </button>
        </div>
    `;
    
    tabsContainer.insertBefore(divider, newTabBtn);
    tabsContainer.insertBefore(newTab, newTabBtn);
    
    newTab.addEventListener('click', (e) => {
        if (e.target.closest('.close-btn')) return;
        
        const tabs = terminal.querySelectorAll('.terminal-tab:not(.new-tab-btn)');
        tabs.forEach(t => {
            t.classList.remove('active');
            const btn = t.querySelector('.close-btn');
            if (btn) btn.remove();
        });
        
        newTab.classList.add('active');
        
        const tabContent = newTab.querySelector('.tab-content');
        if (!tabContent.querySelector('.close-btn')) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'icon-btn close-btn';
            closeBtn.innerHTML = '<img src="assets/icon-close.svg" alt="Close" class="icon">';
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeTab(newTab, terminal);
            });
            tabContent.appendChild(closeBtn);
        }
    });
    
    const closeBtn = newTab.querySelector('.close-btn');
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeTab(newTab, terminal);
    });
}

function addNewTab(terminal) {
    const tabsContainer = terminal.querySelector('.tabs-container');
    const newTabBtn = terminal.querySelector('.new-tab-btn');
    
    const allTabs = terminal.querySelectorAll('.terminal-tab:not(.new-tab-btn)');
    allTabs.forEach(t => {
        t.classList.remove('active');
        const closeBtn = t.querySelector('.close-btn');
        if (closeBtn) closeBtn.remove();
    });
    
    const divider = document.createElement('div');
    divider.className = 'divider';
    
    const newTab = document.createElement('div');
    newTab.className = 'terminal-tab active';
    newTab.innerHTML = `
        <div class="tab-content">
            <div class="tab-info">
                <p class="tab-title">Engineer</p>
                <div class="status running">
                    <img src="assets/ellipse-running.svg" alt="" class="status-dot">
                    <span class="status-text">Running</span>
                </div>
            </div>
            <button class="icon-btn close-btn">
                <img src="assets/icon-close.svg" alt="Close" class="icon">
            </button>
        </div>
    `;
    
    tabsContainer.insertBefore(divider, newTabBtn);
    tabsContainer.insertBefore(newTab, newTabBtn);
    
    newTab.addEventListener('click', (e) => {
        if (e.target.closest('.close-btn')) return;
        
        const tabs = terminal.querySelectorAll('.terminal-tab:not(.new-tab-btn)');
        tabs.forEach(t => {
            t.classList.remove('active');
            const btn = t.querySelector('.close-btn');
            if (btn) btn.remove();
        });
        
        newTab.classList.add('active');
        
        const tabContent = newTab.querySelector('.tab-content');
        if (!tabContent.querySelector('.close-btn')) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'icon-btn close-btn';
            closeBtn.innerHTML = '<img src="assets/icon-close.svg" alt="Close" class="icon">';
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeTab(newTab, terminal);
            });
            tabContent.appendChild(closeBtn);
        }
    });
    
    const closeBtn = newTab.querySelector('.close-btn');
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeTab(newTab, terminal);
    });
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
        }
    } else {
        const existingTerminal = wrapper.querySelector('.terminal');
        const tabs = Array.from(existingTerminal.querySelectorAll('.terminal-tab:not(.new-tab-btn)'));
        
        if (tabs.length <= 1) return;
        
        const activeTab = tabs.find(t => t.classList.contains('active'));
        const otherTabs = tabs.filter(t => t !== activeTab);
        
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
    }
}

function removeTab(tab, terminal) {
    const wasActive = tab.classList.contains('active');
    
    const prevElement = tab.previousElementSibling;
    const nextElement = tab.nextElementSibling;
    
    if (prevElement && prevElement.classList.contains('divider')) {
        prevElement.remove();
    } else if (nextElement && nextElement.classList.contains('divider')) {
        nextElement.remove();
    }
    
    tab.remove();
    
    if (wasActive) {
        const remainingTabs = terminal.querySelectorAll('.terminal-tab:not(.new-tab-btn)');
        if (remainingTabs.length > 0) {
            const newActiveTab = remainingTabs[0];
            newActiveTab.classList.add('active');
            
            const tabContent = newActiveTab.querySelector('.tab-content');
            if (tabContent && !tabContent.querySelector('.close-btn')) {
                const closeBtn = document.createElement('button');
                closeBtn.className = 'icon-btn close-btn';
                closeBtn.innerHTML = '<img src="assets/icon-close.svg" alt="Close" class="icon">';
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    removeTab(newActiveTab, terminal);
                });
                tabContent.appendChild(closeBtn);
            }
        }
    }
}

function initTerminalTabsForElement(terminal) {
    const tabs = terminal.querySelectorAll('.terminal-tab:not(.new-tab-btn)');
    
    tabs.forEach(tab => {
        const newTab = tab.cloneNode(true);
        tab.parentNode.replaceChild(newTab, tab);
        
        newTab.addEventListener('click', (e) => {
            if (e.target.closest('.close-btn')) return;
            
            const allTabs = terminal.querySelectorAll('.terminal-tab:not(.new-tab-btn)');
            allTabs.forEach(t => {
                t.classList.remove('active');
                const closeBtn = t.querySelector('.close-btn');
                if (closeBtn) closeBtn.remove();
            });
            
            newTab.classList.add('active');
            
            const tabContent = newTab.querySelector('.tab-content');
            if (tabContent && !tabContent.querySelector('.close-btn')) {
                const closeBtn = document.createElement('button');
                closeBtn.className = 'icon-btn close-btn';
                closeBtn.innerHTML = '<img src="assets/icon-close.svg" alt="Close" class="icon">';
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    removeTab(newTab, terminal);
                });
                tabContent.appendChild(closeBtn);
            }
        });
    });
    
    const closeBtns = terminal.querySelectorAll('.close-btn');
    closeBtns.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const tab = newBtn.closest('.terminal-tab');
            removeTab(tab, terminal);
        });
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
}
