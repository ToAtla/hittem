import Foundation
import Observation
import SwiftData
import SwiftUI
import UIKit

@MainActor
@Observable
final class DeckStore {
    enum Phase {
        case loading
        case needsPermission
        case denied
        case deck
        case empty
    }

    private(set) var phase: Phase = .loading
    private(set) var candidates: [Candidate] = []   // index 0 = top of deck
    var pendingOutcomeFor: Candidate?               // drives the "how did it go?" sheet

    private let repo = ContactsRepository()
    private var context: ModelContext?

    func bootstrap(context: ModelContext) async {
        self.context = context
        switch repo.authorizationStatus() {
        case .authorized:
            await load()
        case .notDetermined:
            phase = .needsPermission
        case .denied, .restricted:
            phase = .denied
        }
    }

    func requestPermission() async {
        if await repo.requestAccess() {
            await load()
        } else {
            phase = .denied
        }
    }

    func load() async {
        phase = .loading
        let raw: [RawContact]
        do {
            raw = try repo.fetchContacts()
        } catch {
            phase = .denied
            return
        }

        let byId = Dictionary(decisions().map { ($0.contactId, $0) },
                              uniquingKeysWith: { first, _ in first })
        var merged = raw.map { rc -> Candidate in
            let decision = byId[rc.id]
            return Candidate(id: rc.id,
                             name: rc.name,
                             phoneNumber: rc.phoneNumber,
                             phoneLabel: rc.phoneLabel,
                             lastActionDate: decision?.lastActionDate,
                             lastOutcome: decision?.lastOutcome)
        }
        merged.sort(by: Self.rank)
        candidates = merged
        phase = merged.isEmpty ? .empty : .deck
    }

    /// Never-actioned first (alphabetical), then whoever was actioned longest ago.
    static func rank(_ a: Candidate, _ b: Candidate) -> Bool {
        switch (a.lastActionDate, b.lastActionDate) {
        case (nil, nil): return a.name.localizedCaseInsensitiveCompare(b.name) == .orderedAscending
        case (nil, _):   return true
        case (_, nil):   return false
        case let (da?, db?): return da < db
        }
    }

    // MARK: - Swipe actions

    func swipeRight(_ c: Candidate) {        // call now
        placeCall(c)
        pendingOutcomeFor = c                // ask the result when they come back
        advance(c)
    }

    func swipeLeft(_ c: Candidate) {         // skip
        record(c, outcome: .skipped)
        advance(c)
    }

    func recordOutcome(_ outcome: ContactOutcome, for c: Candidate) {
        record(c, outcome: outcome)
        pendingOutcomeFor = nil
    }

    // MARK: - Private

    private func advance(_ c: Candidate) {
        candidates.removeAll { $0.id == c.id }
        if candidates.isEmpty { phase = .empty }
    }

    private func placeCall(_ c: Candidate) {
        let digits = c.phoneNumber.filter { "0123456789+*#".contains($0) }
        guard let url = URL(string: "tel://\(digits)"),
              UIApplication.shared.canOpenURL(url) else { return }
        UIApplication.shared.open(url)
    }

    private func decisions() -> [ContactDecision] {
        guard let context else { return [] }
        return (try? context.fetch(FetchDescriptor<ContactDecision>())) ?? []
    }

    private func record(_ c: Candidate, outcome: ContactOutcome) {
        guard let context else { return }
        let id = c.id
        let descriptor = FetchDescriptor<ContactDecision>(predicate: #Predicate { $0.contactId == id })
        let existing = (try? context.fetch(descriptor))?.first

        if let decision = existing {
            decision.lastActionDate = .now
            decision.lastOutcomeRaw = outcome.rawValue
            if outcome == .skipped { decision.skipCount += 1 } else { decision.callCount += 1 }
        } else {
            context.insert(ContactDecision(contactId: c.id,
                                           displayName: c.name,
                                           outcome: outcome,
                                           callCount: outcome == .skipped ? 0 : 1,
                                           skipCount: outcome == .skipped ? 1 : 0))
        }
        try? context.save()
    }
}
