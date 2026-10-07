# Supports a draft staged in App Store Connect. Deliver 2.237.0 excludes
# READY_FOR_REVIEW versions and refuses drafts containing existing items.
# Loading and validation are read-only; only the guarded lane submits.
module MauticReviewDraft
  class InvalidDraft < StandardError; end

  def self.load(app:, version_string:, build_number:, api:)
    raise InvalidDraft, "A review is already in progress" if app.get_in_progress_review_submission(platform: "IOS")
    drafts = app.get_review_submissions(filter: { platform: "IOS", state: "READY_FOR_REVIEW" })
    raise InvalidDraft, "Multiple review drafts found" if drafts.length > 1
    return nil if drafts.empty?

    draft = drafts.fetch(0)
    items = api::ReviewSubmissionItem.all(review_submission_id: draft.id, includes: "appStoreVersion")
    # Deliver can create the item for an empty draft through its usual path.
    return nil if items.empty?
    versions = app.get_app_store_versions(filter: { platform: "IOS", versionString: version_string })
    raise InvalidDraft, "Expected exactly one matching store version" unless versions.length == 1
    version = api::AppStoreVersion.get(app_store_version_id: versions.fetch(0).id)
    selected_build = version.get_build
    build = selected_build && api::Build.get(build_id: selected_build.id)
    validate!(draft: draft, items: items, version: version, build: build,
              app_id: app.id, version_string: version_string, build_number: build_number)
    { draft: draft, version: version, build: build, item: items.fetch(0) }
  end

  def self.validate!(draft:, items:, version:, build:, app_id:, version_string:, build_number:)
    checks = {
      "Draft is not an unsubmitted iOS draft" => draft.platform == "IOS" && draft.state == "READY_FOR_REVIEW" && draft.submitted_date.nil?,
      "Draft contains other items" => items.length == 1 && items.fetch(0).app_store_version&.id == version.id,
      "Unexpected version or state" => version.platform == "IOS" && version.version_string == version_string && version.app_version_state == "READY_FOR_REVIEW",
      "Manual release is required" => version.release_type == "MANUAL",
      "Wrong or unprocessed build" => build && build.app_id == app_id && build.app_version == version_string && build.version.to_s == build_number.to_s && build.platform == "IOS" && build.processing_state == "VALID" && build.expired == false,
      "Export compliance is missing" => build && [true, false].include?(build.uses_non_exempt_encryption)
    }
    checks.each { |message, valid| raise InvalidDraft, message unless valid }
    true
  end
end
