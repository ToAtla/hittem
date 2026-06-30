import SwiftUI

struct OutcomeSheet: View {
    let candidate: Candidate
    let onPick: (ContactOutcome) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 20) {
            Text("How did the call go?").font(.headline)
            Text(candidate.name).foregroundStyle(.secondary)

            HStack(spacing: 16) {
                Button { onPick(.reached); dismiss() } label: {
                    Label("Reached", systemImage: "checkmark.circle.fill")
                        .frame(maxWidth: .infinity)
                }
                .tint(.green)

                Button { onPick(.noAnswer); dismiss() } label: {
                    Label("No answer", systemImage: "phone.down.fill")
                        .frame(maxWidth: .infinity)
                }
                .tint(.orange)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
        }
        .padding(24)
    }
}
