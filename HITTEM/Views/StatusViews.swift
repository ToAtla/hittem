import SwiftUI
import UIKit

struct PermissionView: View {
    let onAllow: () async -> Void

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "person.crop.circle.badge.questionmark")
                .font(.system(size: 64))
                .foregroundStyle(.tint)
            Text("HITTEM needs your contacts")
                .font(.title2.bold())
            Text("It deals them out as a deck so you can decide who to call. Nothing leaves your phone.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 40)
            Button("Allow contacts") { Task { await onAllow() } }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
        }
        .padding()
    }
}

struct DeniedView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "lock.fill")
                .font(.system(size: 56))
                .foregroundStyle(.secondary)
            Text("Contacts access is off")
                .font(.title2.bold())
            Text("Enable it in Settings › HITTEM › Contacts to start swiping.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 40)
            Button("Open Settings") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
            .buttonStyle(.bordered)
        }
        .padding()
    }
}

struct EmptyDeckView: View {
    let onReload: () async -> Void

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 64))
                .foregroundStyle(.green)
            Text("All caught up")
                .font(.title.bold())
            Text("You have been through everyone for now.")
                .foregroundStyle(.secondary)
            Button("Start over") { Task { await onReload() } }
                .buttonStyle(.bordered)
        }
        .padding()
    }
}
