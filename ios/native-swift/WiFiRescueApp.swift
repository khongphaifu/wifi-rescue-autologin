//
//  WiFiRescueApp.swift
//  Wi-Fi Rescue Auto-Login for iOS (Native SwiftUI Daemon)
//
//  Build instructions (Xcode 15+ / iOS 15.0+):
//  1. Create a new iOS App project in Xcode (SwiftUI) and replace App file with this file.
//  2. In Info.plist, add:
//     - UIBackgroundModes (Array) -> "audio"
//     - NSAppTransportSecurity (Dictionary) -> NSAllowsArbitraryLoads = YES
//     - NSLocalNetworkUsageDescription (String) -> "Can truy cap router Wi-MESH 186.186.0.1 de kich hoat Internet."
//  3. Free Apple ID can sideload via Xcode / Sideloadly / AltStore.
//

import SwiftUI
import Network
import AVFoundation
import UserNotifications

@main
struct WiFiRescueApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

struct RouterStatus {
    var reachable: Bool = false
    var loggedIn: Bool = false
    var secondsLeft: Int = 0
    var rawTimeLeft: String = "--"
    var macEsc: String = ""
    var mac: String = ""
}

final class WiFiRescueDaemon: ObservableObject {
    @Published var isDaemonRunning = false
    @Published var isWifiActive = false
    @Published var status = RouterStatus()
    @Published var logs: [String] = ["Sẵn sàng kích hoạt Wi-Fi Rescue iOS."]

    private let statusURL = URL(string: "http://186.186.0.1/status")!
    private let loginBase = "http://186.186.0.1/login"
    private let logoutURL = URL(string: "http://186.186.0.1/logout")!
    private let proactiveRenewSeconds = 45

    private var pathMonitor: NWPathMonitor?
    private var timer: Timer?
    private var audioPlayer: AVAudioPlayer?

    /// Dedicated URLSession forcing Wi-Fi only (prevents iOS Wi-Fi Assist from sending 186.186.0.1 to 4G/LTE)
    private lazy var wifiSession: URLSession = {
        let cfg = URLSessionConfiguration.ephemeral
        cfg.allowsCellularAccess = false
        cfg.allowsExpensiveNetworkAccess = false
        cfg.allowsConstrainedNetworkAccess = false
        cfg.timeoutIntervalForRequest = 3.5
        cfg.requestCachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        return URLSession(configuration: cfg)
    }()

    init() {
        requestNotificationPermission()
        startNetworkMonitor()
    }

    private func appendLog(_ text: String) {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        let line = "[\(formatter.string(from: Date()))] \(text)"
        DispatchQueue.main.async {
            self.logs.insert(line, at: 0)
            if self.logs.count > 30 {
                self.logs.removeLast()
            }
        }
    }

    private func requestNotificationPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
    }

    private func sendLocalNotification(title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        let req = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(req)
    }

    private func startNetworkMonitor() {
        let monitor = NWPathMonitor(requiredInterfaceType: .wifi)
        monitor.pathUpdateHandler = { [weak self] path in
            let available = path.usesInterfaceType(.wifi)
            DispatchQueue.main.async {
                self?.isWifiActive = available
            }
            if available && (self?.isDaemonRunning == true) {
                self?.checkAndRenewIfNeeded()
            }
        }
        monitor.start(queue: DispatchQueue(label: "com.wifirescue.netmonitor"))
        self.pathMonitor = monitor
    }

    func toggleDaemon() {
        if isDaemonRunning {
            stopDaemon()
        } else {
            startDaemon()
        }
    }

    func startDaemon() {
        startSilentAudioKeepAlive()
        isDaemonRunning = true
        appendLog("Đã bật dịch vụ chạy ngầm 24/7 (Silent Keep-Alive).")

        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            if self.status.loggedIn && self.status.secondsLeft > 0 {
                self.status.secondsLeft -= 1
                if self.status.secondsLeft <= self.proactiveRenewSeconds {
                    self.checkAndRenewIfNeeded()
                }
            }
            // Đồng bộ với router mỗi 15 giây
            if Int(Date().timeIntervalSince1970) % 15 == 0 {
                self.checkAndRenewIfNeeded()
            }
        }
        checkAndRenewIfNeeded()
    }

    func stopDaemon() {
        isDaemonRunning = false
        timer?.invalidate()
        timer = nil
        audioPlayer?.stop()
        audioPlayer = nil
        try? AVAudioSession.sharedInstance().setActive(false)
        appendLog("Đã tắt dịch vụ chạy ngầm.")
    }

    /// Generates an in-memory 44-byte silent PCM WAV to keep the iOS process awake in background
    private func startSilentAudioKeepAlive() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try session.setActive(true)

            var wav = Data([
                0x52, 0x49, 0x46, 0x46, 0x28, 0x00, 0x00, 0x00,
                0x57, 0x41, 0x56, 0x45, 0x66, 0x6D, 0x74, 0x20,
                0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
                0x44, 0xAC, 0x00, 0x00, 0x88, 0x58, 0x01, 0x00,
                0x02, 0x00, 0x10, 0x00, 0x64, 0x61, 0x74, 0x61,
                0x04, 0x00, 0x00, 0x00
            ])
            wav.append(contentsOf: [0x00, 0x00, 0x00, 0x00])

            let player = try AVAudioPlayer(data: wav)
            player.numberOfLoops = -1
            player.volume = 0.001
            player.play()
            self.audioPlayer = player
        } catch {
            appendLog("Cảnh báo audio keep-alive: \(error.localizedDescription)")
        }
    }

    func checkAndRenewIfNeeded(forceRenew: Bool = false) {
        wifiSession.dataTask(with: statusURL) { [weak self] data, _, error in
            guard let self = self else { return }
            if let error = error {
                self.appendLog("Không tới được router 186.186.0.1: \(error.localizedDescription)")
                return
            }
            guard let data = data, let html = String(data: data, encoding: .utf8) else { return }
            let parsed = self.parseRouterHtml(html)
            DispatchQueue.main.async {
                self.status = parsed
            }

            let needsLogin = forceRenew || !parsed.loggedIn || parsed.secondsLeft <= self.proactiveRenewSeconds
            if needsLogin, !parsed.macEsc.isEmpty {
                self.performDirectTrialLogin(macEsc: parsed.macEsc, logoutFirst: parsed.loggedIn)
            }
        }.resume()
    }

    private func performDirectTrialLogin(macEsc: String, logoutFirst: Bool) {
        let doLogin = { [weak self] in
            guard let self = self,
                  let url = URL(string: "\(self.loginBase)?username=T-\(macEsc)") else { return }
            self.wifiSession.dataTask(with: url) { _, _, err in
                if let err = err {
                    self.appendLog("Lỗi kích hoạt 0.2s: \(err.localizedDescription)")
                    return
                }
                self.appendLog("Đã gửi lệnh kích hoạt 0.2s thành công!")
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    self.refreshStatusOnly()
                    self.sendLocalNotification(title: "Wi-Fi Rescue iOS", body: "Đã gia hạn Internet 15 phút thành công!")
                }
            }.resume()
        }

        if logoutFirst {
            wifiSession.dataTask(with: logoutURL) { _, _, _ in doLogin() }.resume()
        } else {
            doLogin()
        }
    }

    private func refreshStatusOnly() {
        wifiSession.dataTask(with: statusURL) { [weak self] data, _, _ in
            guard let self = self, let data = data, let html = String(data: data, encoding: .utf8) else { return }
            let parsed = self.parseRouterHtml(html)
            DispatchQueue.main.async {
                self.status = parsed
            }
        }.resume()
    }

    private func parseRouterHtml(_ html: String) -> RouterStatus {
        var result = RouterStatus(reachable: true)
        result.loggedIn = matchRegex(html, pattern: #"["']?logged-in["']?\s*:\s*"([^"]+)""#)?.lowercased() == "yes"
        let rawLeft = matchRegex(html, pattern: #"["']?session-time-left["']?\s*:\s*"([^"]+)""#) ?? ""
        result.rawTimeLeft = rawLeft.isEmpty ? "0s" : rawLeft
        result.secondsLeft = parseDurationSeconds(rawLeft)
        result.macEsc = matchRegex(html, pattern: #"["']?mac-esc["']?\s*:\s*"([^"]+)""#) ?? ""
        result.mac = matchRegex(html, pattern: #"["']?mac["']?\s*:\s*"([^"]+)""#) ?? ""
        return result
    }

    private func matchRegex(_ text: String, pattern: String) -> String? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
              let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
              match.numberOfRanges > 1,
              let range = Range(match.range(at: 1), in: text) else {
            return nil
        }
        return String(text[range])
    }

    private func parseDurationSeconds(_ str: String) -> Int {
        let lower = str.lowercased()
        var total = 0
        if let hStr = matchRegex(lower, pattern: #"(\d+)\s*h"#), let h = Int(hStr) { total += h * 3600 }
        if let mStr = matchRegex(lower, pattern: #"(\d+)\s*m"#), let m = Int(mStr) { total += m * 60 }
        if let sStr = matchRegex(lower, pattern: #"(\d+)\s*s"#), let s = Int(sStr) { total += s }
        return total
    }
}

struct ContentView: View {
    @StateObject private var daemon = WiFiRescueDaemon()

    private var clockText: String {
        let s = max(0, daemon.status.secondsLeft)
        return String(format: "%02d:%02d", s / 60, s % 60)
    }

    var body: some View {
        NavigationView {
            VStack(spacing: 16) {
                VStack(spacing: 8) {
                    Text("THỜI GIAN PHIÊN CÒN LẠI")
                        .font(.caption.bold())
                        .foregroundColor(.secondary)
                    Text(clockText)
                        .font(.system(size: 56, weight: .heavy, design: .monospaced))
                        .foregroundColor(daemon.status.loggedIn ? .green : .orange)
                    ProgressView(value: Double(min(900, daemon.status.secondsLeft)), total: 900.0)
                        .tint(daemon.status.loggedIn ? .green : .orange)
                    HStack {
                        Text(daemon.status.loggedIn ? "● ONLINE" : "○ CHƯA ĐĂNG NHẬP")
                            .font(.caption.bold())
                            .foregroundColor(daemon.status.loggedIn ? .green : .orange)
                        Spacer()
                        Text("MAC: \(daemon.status.mac.isEmpty ? "--" : daemon.status.mac)")
                            .font(.caption.monospaced())
                            .foregroundColor(.secondary)
                    }
                }
                .padding()
                .background(Color(.secondarySystemBackground))
                .cornerRadius(16)

                Button(action: { daemon.checkAndRenewIfNeeded(forceRenew: true) }) {
                    Text("⚡ Gia Hạn Ngay (0.2s)")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(14)
                }

                Button(action: { daemon.toggleDaemon() }) {
                    Text(daemon.isDaemonRunning ? "🔊 Đang Chạy Ngầm 24/7 (Bấm để tắt)" : "🔇 Bật Tự Động Gia Hạn Ngầm 24/7")
                        .font(.subheadline.bold())
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(daemon.isDaemonRunning ? Color.green.opacity(0.2) : Color(.tertiarySystemBackground))
                        .foregroundColor(daemon.isDaemonRunning ? .green : .primary)
                        .cornerRadius(14)
                }

                List(daemon.logs, id: \.self) { line in
                    Text(line).font(.caption.monospaced())
                }
                .listStyle(.plain)
            }
            .padding()
            .navigationTitle("Wi-Fi Rescue iOS")
        }
    }
}
