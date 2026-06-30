import SwiftUI
import SwiftData

@main
struct HITTEMApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
        }
        .modelContainer(for: ContactDecision.self)
    }
}
