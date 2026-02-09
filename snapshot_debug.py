from playwright.sync_api import sync_playwright

def snapshot_debug():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Grant geolocation to avoid permission prompt blocking
        context = browser.new_context(permissions=["geolocation"])
        page = context.new_page()
        try:
            print("Navigating...")
            page.goto("http://localhost:5173/dashboard/inspections/new/1")
            page.wait_for_timeout(5000)

            print("Taking screenshot...")
            page.screenshot(path="verification.png")
            print("Screenshot saved to verification.png")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    snapshot_debug()
