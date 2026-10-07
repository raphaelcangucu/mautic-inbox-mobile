require "minitest/autorun"
require "ostruct"
require_relative "../review_draft"

class ReviewDraftTest < Minitest::Test
  def setup
    @draft = OpenStruct.new(id: "draft", platform: "IOS", state: "READY_FOR_REVIEW", submitted_date: nil)
    @version = OpenStruct.new(id: "version", platform: "IOS", version_string: "1.0.0", app_version_state: "READY_FOR_REVIEW", release_type: "MANUAL")
    @items = [OpenStruct.new(id: "item", app_store_version: OpenStruct.new(id: "version"))]
    @build = OpenStruct.new(id: "build", app_id: "app", app_version: "1.0.0", version: "24", platform: "IOS", processing_state: "VALID", expired: false, uses_non_exempt_encryption: false)
  end

  def validate
    MauticReviewDraft.validate!(draft: @draft, items: @items, version: @version, build: @build,
                              app_id: "app", version_string: "1.0.0", build_number: "24")
  end

  def test_exact_staged_version_is_accepted
    assert validate
  end

  def test_rejects_other_items
    @items << OpenStruct.new(app_store_version: OpenStruct.new(id: "other"))
    assert_raises(MauticReviewDraft::InvalidDraft) { validate }
  end

  def test_rejects_foreign_version
    @items.first.app_store_version.id = "foreign"
    assert_raises(MauticReviewDraft::InvalidDraft) { validate }
  end

  def test_rejects_non_version_item
    @items.first.app_store_version = nil
    assert_raises(MauticReviewDraft::InvalidDraft) { validate }
  end

  def test_rejects_different_build_or_app
    %i[app_id app_version version platform processing_state].each do |field|
      original = @build.public_send(field)
      @build.public_send("#{field}=", "wrong")
      assert_raises(MauticReviewDraft::InvalidDraft) { validate }
      @build.public_send("#{field}=", original)
    end
  end

  def test_rejects_expired_build_or_missing_compliance
    @build.expired = true
    assert_raises(MauticReviewDraft::InvalidDraft) { validate }
    @build.expired = false
    @build.uses_non_exempt_encryption = nil
    assert_raises(MauticReviewDraft::InvalidDraft) { validate }
  end

  def test_rejects_auto_release
    @version.release_type = "AFTER_APPROVAL"
    assert_raises(MauticReviewDraft::InvalidDraft) { validate }
  end

  def test_rejects_already_submitted_draft
    @draft.submitted_date = "2026-10-07T00:00:00Z"
    assert_raises(MauticReviewDraft::InvalidDraft) { validate }
  end

  def test_rejects_wrong_states
    @draft.state = "WAITING_FOR_REVIEW"
    assert_raises(MauticReviewDraft::InvalidDraft) { validate }
    @draft.state = "READY_FOR_REVIEW"
    @version.app_version_state = "PREPARE_FOR_SUBMISSION"
    assert_raises(MauticReviewDraft::InvalidDraft) { validate }
  end

  def fake_api
    api = Module.new
    item_class = Class.new
    item_class.define_singleton_method(:all) { |**_args| @test_items }
    item_class.instance_variable_set(:@test_items, @items)
    version_class = Class.new
    version_class.define_singleton_method(:get) { |**_args| @test_version }
    @version.define_singleton_method(:get_build) { OpenStruct.new(id: "build") }
    version_class.instance_variable_set(:@test_version, @version)
    build_class = Class.new
    build_class.define_singleton_method(:get) { |**_args| @test_build }
    build_class.instance_variable_set(:@test_build, @build)
    api.const_set(:ReviewSubmissionItem, item_class)
    api.const_set(:AppStoreVersion, version_class)
    api.const_set(:Build, build_class)
    api
  end

  def fake_app(drafts: [@draft], progress: nil, versions: [@version])
    app = OpenStruct.new(id: "app")
    app.define_singleton_method(:get_in_progress_review_submission) { |**_args| progress }
    app.define_singleton_method(:get_review_submissions) { |**_args| drafts }
    app.define_singleton_method(:get_app_store_versions) { |**_args| versions }
    app
  end

  def load(app)
    MauticReviewDraft.load(app: app, version_string: "1.0.0", build_number: "24", api: fake_api)
  end

  def test_load_resolves_the_selected_build_with_its_app_and_version
    result = load(fake_app)
    assert_same @draft, result[:draft]
    assert_same @build, result[:build]
  end

  def test_load_refuses_an_active_review_without_mutating_it
    assert_raises(MauticReviewDraft::InvalidDraft) { load(fake_app(progress: @draft)) }
  end

  def test_load_refuses_ambiguous_drafts_or_versions
    assert_raises(MauticReviewDraft::InvalidDraft) { load(fake_app(drafts: [@draft, @draft])) }
    assert_raises(MauticReviewDraft::InvalidDraft) { load(fake_app(versions: [])) }
  end

  def test_no_draft_or_an_empty_draft_uses_deliver
    assert_nil load(fake_app(drafts: []))
    @items.clear
    assert_nil load(fake_app)
  end
end
