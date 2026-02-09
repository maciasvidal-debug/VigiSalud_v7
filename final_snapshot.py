from playwright.sync_api import sync_playwright

def final_snapshot():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        try:
            print("Navigating to Dashboard...")
            page.goto("http://localhost:5173/dashboard")
            page.wait_for_timeout(5000)

            print("Taking final screenshot...")
            page.screenshot(path="dashboard_success.png")
            print("Screenshot saved to dashboard_success.png")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    final_snapshot()
