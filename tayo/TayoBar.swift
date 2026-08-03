// TayoBar — native macOS menu bar countdown for Tayô (tayo/index.html).
// Mirrors the slot math: SNACK on the hour, STAND on the half hour,
// inside the 09:00–15:00 desk window. Menu-bar only (no Dock icon).
//
// Explicit by request: full words in the bar ("SNACK 14:32" ticking every
// second, "SNACK NOW" during the 10-min break window), and the click-menu
// carries the actual prescription so the app never needs opening.
//
// Build:  swiftc -O TayoBar.swift -o TayoBar
// Ships installed at /Applications/TayoBar.app (built locally, unsigned —
// fine because it never leaves this machine).

import Cocoa

let START = 9 * 60
let END = 15 * 60
let DUE_WINDOW = 10 // minutes a slot stays "NOW" (matches the web page)
let TAYO_URL = "https://kilostraining.vercel.app/tayo/"

// A/B alternation by hour parity — same heuristic as the lock widget;
// the web page owns the day's true rotation.
let SNACK_A = ["3 pull-ups", "5 push-ups", "10 squats"]
let SNACK_B = ["15 squats", "60s brisk walk", "30s hip-flexor stretch"]
let STAND_RX = ["Stand up. Walk somewhere.", "Water counts — 2 minutes."]

struct Slot {
    let m: Int
    let type: String
}

func daySlots() -> [Slot] {
    var out: [Slot] = []
    var m = START
    while m <= END {
        let mm = m % 60
        if mm == 0 && m > START { out.append(Slot(m: m, type: "SNACK")) }
        if mm == 30 { out.append(Slot(m: m, type: "STAND")) }
        m += 1
    }
    return out
}

func prescription(for slot: Slot) -> [String] {
    if slot.type == "STAND" { return STAND_RX }
    return (slot.m / 60) % 2 == 0 ? SNACK_A : SNACK_B
}

class AppDelegate: NSObject, NSApplicationDelegate {
    var item: NSStatusItem!
    var header: NSMenuItem!
    var rxItems: [NSMenuItem] = []
    var timer: Timer?
    var lastMenuKey = ""

    func applicationDidFinishLaunching(_ n: Notification) {
        item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        item.button?.font = NSFont.monospacedDigitSystemFont(ofSize: 12, weight: .semibold)

        let menu = NSMenu()
        header = NSMenuItem(title: "…", action: nil, keyEquivalent: "")
        header.isEnabled = false
        menu.addItem(header)
        menu.addItem(.separator())
        for _ in 0..<3 {
            let rx = NSMenuItem(title: "", action: nil, keyEquivalent: "")
            rx.isEnabled = false
            rx.indentationLevel = 1
            rxItems.append(rx)
            menu.addItem(rx)
        }
        menu.addItem(.separator())
        let open = NSMenuItem(title: "Open Tayô", action: #selector(openTayo), keyEquivalent: "o")
        open.target = self
        menu.addItem(open)
        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "Quit TayoBar", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        item.menu = menu

        update()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            self?.update()
        }
    }

    @objc func openTayo() {
        NSWorkspace.shared.open(URL(string: TAYO_URL)!)
    }

    func setMenu(headerText: String, rx: [String], key: String) {
        guard key != lastMenuKey else {
            header.title = headerText // header may carry a countdown — always fresh
            return
        }
        lastMenuKey = key
        header.title = headerText
        for (i, itemRx) in rxItems.enumerated() {
            itemRx.title = i < rx.count ? rx[i] : ""
            itemRx.isHidden = i >= rx.count
        }
    }

    func update() {
        let cal = Calendar.current
        let now = Date()
        let mins = cal.component(.hour, from: now) * 60 + cal.component(.minute, from: now)
        let secsIntoMin = cal.component(.second, from: now)
        let slots = daySlots()

        // A slot in its 10-minute NOW window takes over the bar.
        if let cur = slots.last(where: { $0.m <= mins && mins < $0.m + DUE_WINDOW }) {
            item.button?.title = "\(cur.type) NOW"
            setMenu(
                headerText: String(format: "TAYO NA — %@ (%02d:%02d)", cur.type, cur.m / 60, cur.m % 60),
                rx: prescription(for: cur),
                key: "now-\(cur.m)"
            )
            return
        }

        if let nxt = slots.first(where: { $0.m > mins }) {
            let totalSecs = (nxt.m - mins) * 60 - secsIntoMin
            item.button?.title = String(format: "%@ %d:%02d", nxt.type, totalSecs / 60, totalSecs % 60)
            setMenu(
                headerText: String(format: "Next: %@ at %02d:%02d", nxt.type, nxt.m / 60, nxt.m % 60),
                rx: prescription(for: nxt),
                key: "next-\(nxt.m)"
            )
        } else if mins < START {
            item.button?.title = "TAYÔ 9:00"
            setMenu(headerText: "Desk window opens 09:00", rx: [], key: "pre")
        } else {
            item.button?.title = "TAYÔ ✓"
            setMenu(headerText: "Done for today", rx: [], key: "post")
        }
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory) // menu bar only — no Dock icon
app.run()
