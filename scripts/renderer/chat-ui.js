/**
 * Chat UI Module
 * Provides CSS styles and UI utilities for chat functionality
 */

function getStyles() {
    return `
/* Chat input box - attached below model */
.chat-input-wrapper {
  position: absolute;
  z-index: 1000;
  pointer-events: auto;
  display: none;
}
.chat-input-wrapper.visible {
  display: block;
}

/* From Uiverse.io by vinodjangid07 - keep original input style */
.messageBox {
  width: fit-content;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #2d2d2d;
  padding: 0 15px;
  border-radius: 10px;
  border: 1px solid rgb(63, 63, 63);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
.messageBox:focus-within {
  border: 1px solid rgb(110, 110, 110);
}

/* From Uiverse.io by cbolson */
.my-form {
  --_clr-primary: #666;
  --_clr-hover: #f33195;
  --_clr-checked: #127acf;
}
.my-form > div {
  --_clr-current: var(--_clr-primary);

  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.my-form > div + div {
  margin-block-start: 0.5rem;
}
.my-form label {
  cursor: pointer;
  color: var(--_clr-current);
  transition: color 150ms ease-in-out;
}
/* styled radio */
.my-form input[type="radio"] {
  appearance: none;
  outline: none;
  width: 1.5rem;
  height: 1.5rem;
  aspect-ratio: 1;
  padding: 0.25rem;
  background: transparent;
  border: 1px solid var(--_clr-current);
  border-radius: 50%;
  display: grid;
  place-content: center;
  cursor: pointer;
  position: relative;
}
.my-form input[type="radio"]::after {
  content: "";
  position: absolute;
  inset: 0.25rem;
  opacity: 0;
  scale: 0;
  transition:
    opacity 150ms ease-in-out,
    scale 150ms ease-in-out;
  background-color: var(--_clr-checked);
  border-radius: inherit;
}

.my-form label:hover,
.my-form input[type="radio"]:focus-visible,
.my-form input[type="radio"]:focus-visible + label,
.my-form input[type="radio"]:hover,
.my-form input[type="radio"]:hover + label {
  --_clr-current: var(--_clr-hover);
}
.my-form input[type="radio"]:focus-visible::after,
.my-form input[type="radio"]:hover::after {
  opacity: 0.5;
  scale: 1;
  background-color: var(--_clr-hover);
}

.my-form input[type="radio"]:checked + label:not(:hover),
.my-form input[type="radio"]:checked:not(:hover) {
  --_clr-current: var(--_clr-checked);
}
.my-form input[type="radio"]:checked::after {
  opacity: 1;
  scale: 1;
}
#messageInput {
  width: 200px;
  height: 100%;
  background-color: transparent;
  outline: none;
  border: none;
  padding-left: 10px;
  color: white;
  font-size: 14px;
}
#messageInput::placeholder {
  color: rgba(255, 255, 255, 0.6);
}
#sendButton {
  width: fit-content;
  height: 100%;
  background-color: transparent;
  outline: none;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
}
#sendButton svg {
  height: 18px;
  transition: all 0.3s;
}
#sendButton svg path {
  transition: all 0.3s;
}
#sendButton:hover svg path {
  fill: #3c3c3c;
  stroke: white;
}

/* Exit chat button - styled to match input box */
.exit-chat-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #2d2d2d;
  border-radius: 10px;
  border: 1px solid rgb(63, 63, 63);
  color: rgba(255, 255, 255, 0.8);
  font-size: 18px;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  margin-left: 8px;
  flex-shrink: 0;
}
.exit-chat-btn:hover {
  border: 1px solid rgb(110, 110, 110);
  color: #ffffff;
  background-color: #3d3d3d;
}

/* Settings button - gear icon */
.settings-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: hsl(240 10% 3.9%);
  border-radius: 10px;
  border: 1px solid hsl(240 5.9% 90%);
  color: hsl(0 0% 98%);
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  margin-right: 8px;
  flex-shrink: 0;
}
.settings-btn:hover {
  border-color: hsl(240 5.9% 10%);
  background-color: hsl(240 3.7% 15.9%);
}

/* AI Settings Modal - Shadcn Style */
.ai-settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 1999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-settings-modal {
  background: hsl(0 0% 100%);
  border: 1px solid hsl(240 5.9% 90%);
  border-radius: 0.5rem;
  padding: 1.5rem;
  width: 90%;
  max-width: 400px;
  max-height: 85vh;
  overflow-y: auto;
  z-index: 2000;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.ai-settings-modal h3 {
  color: hsl(240 10% 3.9%);
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid hsl(240 5.9% 90%);
}

.ai-settings-modal .setting-group {
  margin-bottom: 1rem;
}

.ai-settings-modal .setting-label {
  color: hsl(240 10% 3.9%);
  font-size: 0.8125rem;
  font-weight: 500;
  margin-bottom: 0.375rem;
  display: block;
}

.ai-settings-modal select,
.ai-settings-modal input {
  width: 100%;
  height: 2.25rem;
  padding: 0 0.75rem;
  background: hsl(0 0% 100%);
  border: 1px solid hsl(240 5.9% 90%);
  border-radius: 0.375rem;
  color: hsl(240 10% 3.9%);
  font-size: 0.875rem;
  transition: border-color 0.15s ease;
}

.ai-settings-modal select:focus,
.ai-settings-modal input:focus {
  outline: none;
  border-color: hsl(240 5.9% 10%);
  box-shadow: 0 0 0 1px hsl(240 5.9% 10%);
}

.ai-settings-modal .model-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid hsl(240 5.9% 90%);
  border-radius: 0.375rem;
  padding: 0.5rem;
  background: hsl(240 4.8% 95.9%);
}

.ai-settings-modal .model-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 0.75rem;
  background: hsl(0 0% 100%);
  border-radius: 0.375rem;
  border: 1px solid hsl(240 5.9% 90%);
}

.ai-settings-modal .model-item .model-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: hsl(240 10% 3.9%);
}

.ai-settings-modal .model-item .model-size {
  font-size: 0.75rem;
  color: hsl(240 3.8% 46.1%);
}

.ai-settings-modal .model-item .delete-btn {
  background: transparent;
  border: 1px solid hsl(0 84.2% 60.2%);
  color: hsl(0 84.2% 60.2%);
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 500;
  transition: all 0.15s ease;
}

.ai-settings-modal .model-item .delete-btn:hover {
  background: hsl(0 84.2% 60.2%);
  color: hsl(0 0% 98%);
}

.ai-settings-modal .empty-text {
  color: hsl(240 3.8% 46.1%);
  font-size: 0.8125rem;
  text-align: center;
  padding: 1rem;
}

.ai-settings-modal .path-row {
  display: flex;
  gap: 0.5rem;
}

.ai-settings-modal .path-row input {
  flex: 1;
}

.ai-settings-modal .path-row button {
  flex-shrink: 0;
  height: 2.25rem;
  padding: 0 0.75rem;
}

.ai-settings-modal .btn-row {
  display: flex;
  gap: 0.5rem;
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid hsl(240 5.9% 90%);
}

.ai-settings-modal .btn {
  flex: 1;
  height: 2.25rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.15s ease;
}

.ai-settings-modal .btn-primary {
  background: hsl(240 5.9% 10%);
  color: hsl(0 0% 98%);
}

.ai-settings-modal .btn-primary:hover {
  background: hsl(240 5.9% 10% / 0.9);
}

.ai-settings-modal .btn-secondary {
  background: hsl(240 4.8% 95.9%);
  color: hsl(240 5.9% 10%);
  border: 1px solid hsl(240 5.9% 90%);
}

.ai-settings-modal .btn-secondary:hover {
  background: hsl(240 4.8% 95.9% / 0.8);
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .settings-btn {
    background-color: hsl(240 10% 3.9%);
    border-color: hsl(240 3.7% 15.9%);
  }
  .settings-btn:hover {
    background-color: hsl(240 3.7% 15.9%);
    border-color: hsl(240 4.9% 83.9%);
  }
  
  .ai-settings-modal {
    background: hsl(0 0% 100%);
  }
  
  .ai-settings-modal h3 {
    color: hsl(240 10% 3.9%);
    border-bottom-color: hsl(240 5.9% 90%);
  }
  
  .ai-settings-modal .setting-label {
    color: hsl(240 10% 3.9%);
  }
  
  .ai-settings-modal select,
  .ai-settings-modal input {
    background: hsl(0 0% 100%);
    border-color: hsl(240 5.9% 90%);
    color: hsl(240 10% 3.9%);
  }
  
  .ai-settings-modal .model-list {
    background: hsl(240 4.8% 95.9%);
    border-color: hsl(240 5.9% 90%);
  }
  
  .ai-settings-modal .model-item {
    background: hsl(0 0% 100%);
    border-color: hsl(240 5.9% 90%);
  }
  
  .ai-settings-modal .model-item .model-name {
    color: hsl(240 10% 3.9%);
  }
  
  .ai-settings-modal .model-item .model-size {
    color: hsl(240 3.8% 46.1%);
  }
  
  .ai-settings-modal .empty-text {
    color: hsl(240 3.8% 46.1%);
  }
  
  .ai-settings-modal .btn-row {
    border-top-color: hsl(240 5.9% 90%);
  }
  
  .ai-settings-modal .btn-primary {
    background: hsl(240 5.9% 10%);
    color: hsl(0 0% 98%);
  }
  
  .ai-settings-modal .btn-secondary {
    background: hsl(240 4.8% 95.9%);
    color: hsl(240 5.9% 10%);
    border-color: hsl(240 5.9% 90%);
  }
}

/* AI Speech Bubble - Minimalist Design */
.ai-bubble {
  position: absolute;
  max-width: 280px;
  min-width: 120px;
  background: #FFFFFF;
  color: #333333;
  padding: 14px 18px;
  border-radius: 20px;
  font-size: 14px;
  line-height: 1.6;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(0, 0, 0, 0.05);
  z-index: 999;
  pointer-events: none;
  opacity: 0;
  transform: translateY(10px) scale(0.95);
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ai-bubble.visible {
  opacity: 1;
  transform: translateY(0) scale(1);
}
.ai-bubble::after {
  content: '';
  position: absolute;
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  border-top: 10px solid #FFFFFF;
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.05));
}
.ai-bubble.error {
  background: #FFF5F5;
  border: 1px solid rgba(255, 100, 100, 0.2);
  color: #C53030;
}
.ai-bubble.error::after {
  border-top-color: #FFF5F5;
}
.bubble-text {
  word-wrap: break-word;
}

/* System Notification - separate from chat bubble */
.system-notification {
  position: absolute;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border: 1px solid rgba(102, 126, 234, 0.5);
  border-radius: 12px;
  padding: 10px 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), 0 0 12px rgba(102, 126, 234, 0.2);
  z-index: 1003;
  pointer-events: none;
  opacity: 0;
  transform: translateY(10px) scale(0.95);
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.system-notification.visible {
  opacity: 1;
  transform: translateY(0) scale(1);
}
.notification-content {
  display: flex;
  align-items: center;
  gap: 10px;
}
.notification-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #64c864 0%, #4aa84a 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: white;
  flex-shrink: 0;
}
.notification-text {
  color: white;
}
.notification-subtitle {
  font-size: 13px;
  font-weight: 500;
}

/* Loading spinner - positioned at top-right of model */
/* From Uiverse.io by abrahamcalsin */
.ai-loading-spinner {
  position: absolute;
  --uib-size: 28px;
  --uib-speed: .9s;
  --uib-color: #ffffff;
  display: none;
  align-items: center;
  justify-content: flex-start;
  height: var(--uib-size);
  width: var(--uib-size);
  z-index: 1002;
  pointer-events: none;
}
.ai-loading-spinner.visible {
  display: flex;
}
.ai-loading-spinner .dot-spinner__dot {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  height: 100%;
  width: 100%;
}
.ai-loading-spinner .dot-spinner__dot::before {
  content: '';
  height: 20%;
  width: 20%;
  border-radius: 50%;
  background-color: var(--uib-color);
  transform: scale(0);
  opacity: 0.5;
  animation: pulse0112 calc(var(--uib-speed) * 1.111) ease-in-out infinite;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
}
.ai-loading-spinner .dot-spinner__dot:nth-child(2) { transform: rotate(45deg); }
.ai-loading-spinner .dot-spinner__dot:nth-child(2)::before { animation-delay: calc(var(--uib-speed) * -0.875); }
.ai-loading-spinner .dot-spinner__dot:nth-child(3) { transform: rotate(90deg); }
.ai-loading-spinner .dot-spinner__dot:nth-child(3)::before { animation-delay: calc(var(--uib-speed) * -0.75); }
.ai-loading-spinner .dot-spinner__dot:nth-child(4) { transform: rotate(135deg); }
.ai-loading-spinner .dot-spinner__dot:nth-child(4)::before { animation-delay: calc(var(--uib-speed) * -0.625); }
.ai-loading-spinner .dot-spinner__dot:nth-child(5) { transform: rotate(180deg); }
.ai-loading-spinner .dot-spinner__dot:nth-child(5)::before { animation-delay: calc(var(--uib-speed) * -0.5); }
.ai-loading-spinner .dot-spinner__dot:nth-child(6) { transform: rotate(225deg); }
.ai-loading-spinner .dot-spinner__dot:nth-child(6)::before { animation-delay: calc(var(--uib-speed) * -0.375); }
.ai-loading-spinner .dot-spinner__dot:nth-child(7) { transform: rotate(270deg); }
.ai-loading-spinner .dot-spinner__dot:nth-child(7)::before { animation-delay: calc(var(--uib-speed) * -0.25); }
.ai-loading-spinner .dot-spinner__dot:nth-child(8) { transform: rotate(315deg); }
.ai-loading-spinner .dot-spinner__dot:nth-child(8)::before { animation-delay: calc(var(--uib-speed) * -0.125); }
@keyframes pulse0112 {
  0%, 100% { transform: scale(0); opacity: 0.5; }
  50% { transform: scale(1); opacity: 1; }
}

/* Context Menu Item */
.context-menu-item::before {
  content: "";
  position: absolute;
  top: 5px;
  left: -15px;
  width: 5px;
  height: 80%;
  background-color: #2f81f7;
  border-radius: 5px;
  opacity: 0;
  transition: 1s;
}
.context-menu-item:hover::before,
.context-menu-item:focus::before {
  opacity: 1;
}

/* Operator Panel */
.operator-panel {
  position: fixed;
  z-index: 10000;
  display: none;
  font-family: Arial, sans-serif;
  user-select: none;
}
.operator-panel.visible {
  display: block;
}
/* From Uiverse.io by ElSombrero2 */
.card {
  width: 190px;
  height: 254px;
  background: #171717;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  position: relative;
  box-shadow: 0px 0px 3px 1px #00000088;
  cursor: pointer;
}
.card .content {
  border-radius: 5px;
  background: #171717;
  width: 186px;
  height: 250px;
  z-index: 1;
  padding: 20px;
  color: white;
  display: flex;
  justify-content: flex-start;
  align-items: flex-start;
  box-sizing: border-box;
}
.content::before {
  opacity: 0;
  transition: opacity 300ms;
  content: " ";
  display: block;
  background: white;
  width: 5px;
  height: 50px;
  position: absolute;
  filter: blur(50px);
  overflow: hidden;
}
.card:hover .content::before {
  opacity: 1;
}
.card::before {
  opacity: 0;
  content: " ";
  position: absolute;
  display: block;
  width: 80px;
  height: 360px;
  background: linear-gradient(#ff2288, #387ef0);
  transition: opacity 300ms;
  animation: rotation_9018 8000ms infinite linear;
  animation-play-state: paused;
}
.card:hover::before {
  opacity: 1;
  animation-play-state: running;
}
.card::after {
  position: absolute;
  content: " ";
  display: block;
  width: 250px;
  height: 360px;
  background: #17171733;
  backdrop-filter: blur(50px);
}
@keyframes rotation_9018 {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
/* From Uiverse.io by cbolson */
.my-form {
  --_clr-primary: #666;
  --_clr-hover: #f33195;
  --_clr-checked: #127acf;
}
.my-form > div {
  --_clr-current: var(--_clr-primary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.operator-card-actions {
  position: absolute;
  right: 14px;
  bottom: 14px;
  z-index: 2;
}
.operator-exit-btn {
  background: transparent;
  border: 1px solid #666;
  border-radius: 2px;
  color: #666;
  cursor: pointer;
  font: inherit;
  padding: 4px 10px;
  transition: border-color 150ms ease-in-out, color 150ms ease-in-out;
}
.operator-exit-btn:hover,
.operator-exit-btn:focus-visible {
  border-color: #f33195;
  color: #f33195;
  outline: none;
}
.my-form > div + div {
  margin-block-start: 0.5rem;
}
.my-form label {
  cursor: pointer;
  color: var(--_clr-current);
  transition: color 150ms ease-in-out;
}
.my-form input[type="checkbox"] {
  appearance: none;
  outline: none;
  width: 1.5rem;
  height: 1.5rem;
  aspect-ratio: 1;
  padding: 0.25rem;
  background: transparent;
  border: 1px solid var(--_clr-current);
  border-radius: 2px;
  display: grid;
  place-content: center;
  cursor: pointer;
}
.my-form input[type="checkbox"]::after {
  content: "\\2714";
  opacity: 0;
  transition: opacity 150ms ease-in-out;
  color: var(--_clr-checked);
  font-size: inherit;
  font-family: inherit;
}
.my-form label:hover,
.my-form input[type="checkbox"]:focus-visible,
.my-form input[type="checkbox"]:focus-visible + label,
.my-form input[type="checkbox"]:hover,
.my-form input[type="checkbox"]:hover + label {
  --_clr-current: var(--_clr-hover);
}
.my-form input[type="checkbox"]:focus-visible::after,
.my-form input[type="checkbox"]:hover::after {
  opacity: 0.5;
  color: var(--_clr-hover);
}
.my-form input[type="checkbox"]:checked + label:not(:hover),
.my-form input[type="checkbox"]:checked:not(:hover) {
  --_clr-current: var(--_clr-checked);
}
.my-form input[type="checkbox"]:checked::after {
  opacity: 1;
}
`;
}

module.exports = {
    getStyles
};
