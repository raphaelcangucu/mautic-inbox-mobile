require 'minitest/autorun'
require_relative '../listing_guard'

class ListingGuardTest < Minitest::Test
  Version = Struct.new(:version_string, :app_store_state)

  def test_editable_version_allowed
    MauticListingGuard::EDITABLE_STATES.each do |state|
      version = Version.new('1.0.1', state)
      assert_equal version, MauticListingGuard.validate!(version: version, expected_version: '1.0.1')
    end
  end

  def test_active_review_and_released_version_blocked
    %w[READY_FOR_REVIEW WAITING_FOR_REVIEW IN_REVIEW PENDING_DEVELOPER_RELEASE READY_FOR_SALE].each do |state|
      assert_raises(RuntimeError) do
        MauticListingGuard.validate!(version: Version.new('1.0.0', state), expected_version: '1.0.0')
      end
    end
  end

  def test_missing_or_other_version_blocked
    [nil, Version.new('1.0.0', 'PREPARE_FOR_SUBMISSION')].each do |version|
      assert_raises(RuntimeError) { MauticListingGuard.validate!(version: version, expected_version: '1.0.1') }
    end
  end
end
