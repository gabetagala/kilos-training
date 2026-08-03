// TayoBar — native macOS menu bar countdown for Tayô (tayo/index.html).
// Mirrors the slot math: SNACK on the hour, STAND on the half hour,
// inside the 09:00–15:00 desk window. Menu-bar only (no Dock icon).
//
// Build:  swiftc -O TayoBar.swift -o TayoBar
// Ships installed at /Applications/TayoBar.app (built locally, unsigned —
// fine because it never leaves this machine).

import Cocoa

let START = 9 * 60
let END = 15 * 60
let TAYO_URL = "https://kilostraining.vercel.app/tayo/"

func nextSlot(after mins: Int) -> (m: Int, type: String)? {
    var m = START
    while m <= END {
        let mm = m % 60
        if mm == 0 && m > START && m > mins { return (m, "SNACK") }
        if mm == 30 && m > mins { return (m, "STAND") }
        m += 1
    }
    return nil
}

class AppDelegate: NSObject, NSApplicationDelegate {
    var item: NSStatusItem!
    var info: NSMenuItem!
    var timer: Timer?

    func applicationDidFinishLaunching(_ n: Notification) {
        item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        item.button?.font = NSFont.monospacedDigitSystemFont(ofSize: 12, weight: .semibold)

        let menu = NSMenu()
        info = NSMenuItem(title: "…", action: nil, keyEquivalent: "")
        info.isEnabled = false
        menu.addItem(info)
        menu.addItem(.separator())
        let open = NSMenuItem(title: "Open Tayô", action: #selector(openTayo), keyEquivalent: "o")
        open.target = self
        menu.addItem(open)
        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "Quit TayoBar", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        item.menu = menu

        update()
        timer = Timer.scheduledTimer(withTimeInterval: 15, repeats: true) { [weak self] _ in
            self?.update()
        }
    }

    @objc func openTayo() {
        NSWorkspace.shared.open(URL(string: TAYO_URL)!)
    }

    func update() {
        let cal = Calendar.current
        let now = Date()
        let mins = cal.component(.hour, from: now) * 60 + cal.component(.minute, from: now)
        if mins < START {
            item.button?.title = "↑ 9:00"
            info.title = "Desk window opens 09:00"
        } else if let s = nextSlot(after: mins) {
            let left = s.m - mins
            item.button?.title = "↑ \(s.type.prefix(1))·\(left)m"
            info.title = String(format: "Next: %@ at %02d:%02d", s.type, s.m / 60, s.m % 60)
        } else {
            item.button?.title = "↑ ✓"
            info.title = "Done for today"
        }
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory) // menu bar only — no Dock icon
app.run()
