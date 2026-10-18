<div align="center">

# 🔴 TRUSTED OWO GEN V4
### Enterprise Concurrent Multi-Token Discord OwO Automation Suite
*High-performance concurrent farming engine with a Crimson-Red Framer Motion Web Dashboard*

[![GitHub Repository](https://img.shields.io/badge/GitHub-trusted--owo--genv4-ef4444?style=for-the-badge&logo=github)](https://github.com/shauryapatel044-dotcom/trusted-owo-genv4)
[![Node.js Version](https://img.shields.io/badge/Node.js-≥18.0.0-10b981?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-3178c6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Discord.js](https://img.shields.io/badge/Discord.js-Selfbot--v13-5865F2?style=for-the-badge&logo=discord)](https://discord.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

</div>

---

## ⚡ What Makes Gen V4 Special?

Trusted OwO Gen V4 is completely redesigned for power users who want to run **multiple Discord accounts simultaneously** with zero repetitive setup and complete visual control.

* **👥 3 Tokens Run Together**: Feed up to 3 Discord user tokens on launch. Each account gets its own isolated WebSocket Gateway connection and independent event loop.
* **⚙️ 1-Time Unified Setup**: Configure your target server, channels, features, lootbox options, sleep timings, and captcha API **once** — it is automatically cloned and applied to all running accounts.
* **🔴 Red-Themed Framer Motion Dashboard**: A cyber-aesthetic dark obsidian and crimson-red web control center accessible right from your browser.
* **🌐 Pterodactyl & VPS Native**: Out-of-the-box support for hosting panels (VISIHOST, Pterodactyl, Docker, Ubuntu/Debian VPS) with automatic port injection and IPv4 Gateway routing.
* **🛡️ Humanlike Anti-Ban Emulation**: Realistic keystroke latency, randomized interval jitter, dynamic sleep schedules, and instant auto-pause upon captcha detection.

---

## 🚀 Interactive Startup Sequence

When you launch the tool, you are guided through a streamlined 3-step setup:

```
[1] 🔴 Enter Dashboard Port (default: 3000)
    ↳ Boots the Red Web Dashboard on the chosen port (or auto-assigned VPS port).

[2] ⚡ Multi-Token Setup (Up to 3 Accounts)
    ↳ [Account 1/3] Enter Discord Token: (validates connection)
    ↳ [Account 2/3] Enter Discord Token: (or press Enter to skip)
    ↳ [Account 3/3] Enter Discord Token: (or press Enter to skip)

[3] ⚙️ 1-Time Unified Configuration
    ↳ Select Discord Server (Guild) & Target Channel(s)
    ↳ Toggle Features (Huntbot, Battle, Pray, Cookie, Clover, Sleep, Lootbox)
    ↳ Configure Captcha Solver & Discord Webhook Alerts
    ↳ [Auto-Apply] All accounts inherit settings and start farming concurrently!
```

---

## 💻 Web Dashboard (Framer Motion & Multi-Page)

The dashboard is accessible from any browser at `http://<your-ip>:<port>`. It features:

| Page | Description |
|---|---|
| **📊 Overview** | Live KPI metrics (Active bots, commands sent, captchas solved, uptime) + 3 live account status cards with real-time latency and individual Pause/Resume controls. |
| **👥 Accounts** | Detailed account roster with masked tokens, Discord user tags, ping, and active channel indicators. |
| **💻 Live Terminal** | Real-time console feed connected via Server-Sent Events (SSE) with color-coded log levels (`SENT`, `INFO`, `WARN`, `ERROR`), log filtering by account/level, and auto-scroll lock. |
| **⚙️ Shared Config** | Interactive neon toggle switches for every feature with a **"Save & Apply to All 3 Accounts"** button that dynamically syncs active farming loops without restarts. |
| **🛡️ Safety & Captcha** | Live monitoring of human emulation delays, typing timers, sleep cycles, and captcha accuracy. |

---

## 📦 Quick Installation

### Option 1: Linux VPS & Hosting Panels (Pterodactyl / VISIHOST)

```bash
# 1. Clone the repository
git clone https://github.com/shauryapatel044-dotcom/trusted-owo-genv4.git
cd trusted-owo-genv4

# 2. Install dependencies
npm install

# 3. Start the tool
npm start
# (or 'node index.js' for hosting panels where Main File is index.js)
```

> [!TIP]
> **Run 24/7 in background on VPS:**
> ```bash
> screen -S owo npm start
> # Press Ctrl + A then D to detach. Re-open anytime with: screen -r owo
> ```

---

### Option 2: Windows PC

1. Ensure **[Node.js 18+](https://nodejs.org)** is installed.
2. Clone or download this repository:
   ```cmd
   git clone https://github.com/shauryapatel044-dotcom/trusted-owo-genv4.git
   cd trusted-owo-genv4
   ```
3. Run `run.bat` or:
   ```cmd
   npm install
   npm start
   ```

---

## ⚙️ Core Configuration Options

| Setting | Default | Description |
|---|---|---|
| `autoHuntbot` | `true` | Automates `/owo huntbot` and upgrades traits (efficiency, duration, cost, radar). |
| `autoBattle` | `true` | Automates `/owo battle` at optimal cooldown intervals. |
| `autoPray` | `["pray"]` | Automates praying or cursing target users or self. |
| `autoDaily` | `true` | Claims `/owo daily` streak automatically every 24 hours. |
| `autoCookie` | `true` | Sends cookies to server admin/co-farmers. |
| `autoClover` | `true` | Gives lucky clovers for boosted gem luck. |
| `autoGem` | `0` | Auto-equips gems based on rarity tiers (Common ➔ Mythical). |
| `autoLootbox` | `true` | Opens regular lootboxes (`/owo lb all`). |
| `autoSleep` | `true` | Pauses farming at randomized intervals to simulate human sleep. |
| `captchaAPI` | `none` | Supports **2Captcha** & **YesCaptcha** API keys for automated solving. |
| `webhookURL` | `optional` | Sends instant Discord alerts on captcha detection or milestone events. |

---

## 🛡️ Anti-Ban Emulation Architecture

1. **Randomized Typing Delay**: Sends `sendTyping()` to Discord Gateway and waits 500ms–1400ms before sending commands, identical to official client typing.
2. **Jitter Cooldowns**: Cooldowns dynamically vary by ±2.5 seconds to prevent fixed-interval bot pattern detection.
3. **Channel Hopping**: Periodically switches between specified channel IDs to distribute activity.
4. **Instant Captcha Freeze**: When OwO triggers a DM or captcha ping, the affected account freezes its command loop immediately and emits an audio/webhook alert.

---

## 🛠️ Repository & Links

* **Repository URL**: [https://github.com/shauryapatel044-dotcom/trusted-owo-genv4](https://github.com/shauryapatel044-dotcom/trusted-owo-genv4)
* **Clone HTTPS**: `git clone https://github.com/shauryapatel044-dotcom/trusted-owo-genv4.git`
* **Clone SSH**: `git clone git@github.com:shauryapatel044-dotcom/trusted-owo-genv4.git`

---

## 📜 Disclaimer
*This software is intended for educational purposes only. Automated interaction with Discord user accounts violates Discord's Terms of Service. Use at your own discretion.*