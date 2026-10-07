# Prevent future listing uploads from modifying an active Apple review.
module MauticListingGuard
  EDITABLE_STATES = %w[PREPARE_FOR_SUBMISSION DEVELOPER_REJECTED REJECTED METADATA_REJECTED].freeze

  def self.validate!(version:, expected_version:)
    raise 'Unexpected editable store version' unless version && version.version_string == expected_version
    raise "Listing is locked for publication while Apple state is #{version.app_store_state}" unless EDITABLE_STATES.include?(version.app_store_state)
    version
  end
end
