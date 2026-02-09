from playwright.sync_api import sync_playwright

def debug_page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            print("Navigating...")
            page.goto("http://localhost:5173/dashboard/inspections/new/1")
            page.wait_for_timeout(5000)

            print(f"URL: {page.url}")
            print(f"Title: {page.title()}")

            # Check for specific text indicating state
            if "Cargando Expediente" in page.content():
                print("Status: Loading Spinner detected.")
            elif "No se encontró" in page.content():
                 print("Status: Establishment Not Found.")
            else:
                 print("Status: Page loaded (content check needed).")

            # Print body text summary
            print("Body Text Preview:", page.locator("body").inner_text()[:500])

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    debug_page()
