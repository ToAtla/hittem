import SwiftUI
import SwiftData

struct RootView: View {
    @Environment(\.modelContext) private var modelContext
    @State private var store = DeckStore()

    var body: some View {
        @Bindable var store = store

        Group {
            switch store.phase {
            case .loading:
                ProgressView("Loading contacts…")
            case .needsPermission:
                PermissionView { await store.requestPermission() }
            case .denied:
                DeniedView()
            case .deck:
                DeckView(store: store)
            case .empty:
                EmptyDeckView { await store.load() }
            }
        }
        .task { await store.bootstrap(context: modelContext) }
        .sheet(item: $store.pendingOutcomeFor) { candidate in
            OutcomeSheet(candidate: candidate) { outcome in
                store.recordOutcome(outcome, for: candidate)
            }
            .presentationDetents([.height(240)])
        }
    }
}
