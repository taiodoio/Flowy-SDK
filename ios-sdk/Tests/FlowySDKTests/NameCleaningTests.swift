import XCTest
@testable import FlowySDK

final class NameCleaningTests: XCTestCase {
    
    func testCleanScreenName_ScrollList() {
        let input = "Scroll List (NoStyle...)"
        let expected = "Scroll List"
        let result = FlowyHeuristics.cleanScreenName(input)
        XCTAssertEqual(result, expected)
    }
    
    func testCleanScreenName_UIHostingControllerWrapper() {
        let input = "UIHostingController<MyView>"
        let expected = "MyView"
        let result = FlowyHeuristics.cleanScreenName(input)
        XCTAssertEqual(result, expected)
    }
    
    func testCleanScreenName_ModulePrefix() {
        let input = "MyApp.SettingsView"
        let expected = "SettingsView"
        let result = FlowyHeuristics.cleanScreenName(input)
        XCTAssertEqual(result, expected)
    }
    
    func testCleanScreenName_SplitView() {
        let input = "UISplitViewController"
        let expected = "Split View"
        let result = FlowyHeuristics.cleanScreenName(input)
        XCTAssertEqual(result, expected)
    }
    
    func testCleanElementText_SystemButton() {
        let input = "_UIButtonBarButton" // If this leaks through
        let expected = "Element" // It catches starts with _
        let result = FlowyHeuristics.cleanElementText(input)
        XCTAssertEqual(result, expected)
    }
    
    func testCleanElementText_LayoutJunk() {
        let input = "SwiftUI.Layout"
        let expected = "Element"
        let result = FlowyHeuristics.cleanElementText(input)
        XCTAssertEqual(result, expected)
    }
    
    func testCleanElementText_Normal() {
        let input = "Submit"
        let expected = "Submit"
        let result = FlowyHeuristics.cleanElementText(input)
        XCTAssertEqual(result, expected)
    }
}
