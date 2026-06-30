import Foundation
import SwiftData

enum ContactOutcome: String, Codable, CaseIterable {
    case reached
    case noAnswer
    case skipped
}

/// Persisted record of the last action taken on a contact.
/// One row per contact, keyed by the stable Contacts identifier.
@Model
final class ContactDecision {
    @Attribute(.unique) var contactId: String
    var displayName: String
    var lastActionDate: Date
    var lastOutcomeRaw: String
    var callCount: Int
    var skipCount: Int

    init(contactId: String,
         displayName: String,
         lastActionDate: Date = .now,
         outcome: ContactOutcome,
         callCount: Int = 0,
         skipCount: Int = 0) {
        self.contactId = contactId
        self.displayName = displayName
        self.lastActionDate = lastActionDate
        self.lastOutcomeRaw = outcome.rawValue
        self.callCount = callCount
        self.skipCount = skipCount
    }

    var lastOutcome: ContactOutcome {
        ContactOutcome(rawValue: lastOutcomeRaw) ?? .skipped
    }
}
