from playwright.sync_api import sync_playwright
import time

def verify_ux_logic():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Grant geolocation permission or just handle the error flow (which is easier and robustness test)
        context = browser.new_context(permissions=["geolocation"], geolocation={"latitude": 4.6, "longitude": -74.0})
        # Note: Even with permission, if Establishment has no coords, it fails.
        # Assuming Establishment 1 has data.

        page = context.new_page()

        print("Navigating to Inspection Form...")
        page.goto("http://localhost:5173/dashboard/inspections/new/1")

        # Wait for load
        page.wait_for_timeout(3000)

        # --- WIZARD STEP 1: GPS ---
        print("Handling GPS Step...")
        # Check if we need to bypass
        if page.get_by_role("button", name="Justificar Excepción").is_visible():
            print("GPS Failed/Blocked. Using Contingency...")
            page.get_by_role("button", name="Justificar Excepción").click()
            page.wait_for_timeout(500)
            page.get_by_role("button", name="Asumo Responsabilidad").click()
        elif page.get_by_role("button", name="Validación Exitosa").is_visible():
            print("GPS Success.")
            page.get_by_role("button", name="Validación Exitosa").click()
        else:
            # Maybe it's still calculating or stuck
            print("Waiting for GPS...")
            page.wait_for_timeout(5000)
            if page.get_by_role("button", name="Justificar Excepción").is_visible():
                 page.get_by_role("button", name="Justificar Excepción").click()
                 page.wait_for_timeout(500)
                 page.get_by_role("button", name="Asumo Responsabilidad").click()
            elif page.get_by_role("button", name="Validación Exitosa").is_visible():
                 page.get_by_role("button", name="Validación Exitosa").click()

        page.wait_for_timeout(1000)

        # --- WIZARD STEP 2: MOTIVE ---
        print("Handling Motive Step...")
        # Select Motive: PROGRAMACION (default)
        # Need to select Attended By if validation requires it.
        # Logic: validateStep2() checks attendedBy.

        # Select "Otra Persona / Encargado" to show inputs
        page.get_by_role("button", name="Otra Persona / Encargado").click()
        page.wait_for_timeout(500)

        # Fill Attended Data
        page.get_by_placeholder("BUSCAR O ESCRIBIR...").fill("JUAN PEREZ")
        page.get_by_placeholder("Ej: 1.140...").fill("12345678")
        page.get_by_placeholder("Ej: EMPLEADO").fill("ENCARGADO")

        # Click Start
        page.get_by_role("button", name="Iniciar Diligencia").click()
        page.wait_for_timeout(1000)

        # --- STEP 3: INSPECTION FORM ---
        print("Entered Inspection Form. Switching to PRODUCTS tab...")

        # 1. Navigate to PRODUCTS tab
        page.get_by_role("button", name="Continuar a Inventario").click()
        page.wait_for_timeout(1000)

        # 2. Test "Reportar Hallazgo" UI (Progressive Disclosure)
        print("Testing 'Reportar Hallazgo'...")
        report_btn = page.get_by_role("button", name="REPORTAR HALLAZGO")
        if report_btn.is_visible():
            report_btn.click()
            page.wait_for_timeout(500)

            # Verify Chips are visible
            print("Verifying Risk Chips...")
            chips = ["VENCIDO", "SIN_REGISTRO", "MAL_ALMACENAMIENTO"] # Note: Text might be "VENCIDO" or "SIN REGISTRO" depending on replace format
            # In code: {risk.replace(/_/g, ' ')}
            # "SIN_REGISTRO" -> "SIN REGISTRO"

            if page.get_by_role("button", name="SIN REGISTRO").is_visible():
                 print(f"✅ Chip 'SIN REGISTRO' is visible.")
            elif page.get_by_role("button", name="SIN_REGISTRO").is_visible():
                 print(f"✅ Chip 'SIN_REGISTRO' is visible.")
            else:
                 print(f"❌ Chip 'SIN REGISTRO' NOT found.")

            # Select a risk
            # Use general selector if specific name fails
            page.locator("button").filter(has_text="VENCIDO").first.click()
            print("Selected 'VENCIDO'.")

        # 3. Test SeizureCalculator Logic (Discrete vs Volumetric)
        print("Testing SeizureCalculator Logic...")

        # Set Type to MEDICAMENTO
        # Find the first select (Category)
        # Since I can't easily identify by label, I'll assume order or use placeholder.
        # <select value={newProduct.type} ...>
        # Options: MEDICAMENTO, DISPOSITIVO_MEDICO...

        page.locator("select").nth(0).select_option("MEDICAMENTO")

        # Set Seizure Type to DECOMISO to show Calculator
        # It's inside the Hallazgo panel.
        # Label: "Medida a Aplicar"
        page.locator("select").filter(has_text="Seleccione...").last.select_option("DECOMISO")

        # Case A: Discrete (Tableta)
        print("Case A: Discrete (Tableta)...")
        # We need to set Pharmaceutical Form to TABLETA.
        # This is a select in the main form.
        # But wait, in "Reportar Hallazgo" mode, do we see main form?
        # Yes, "Reportar Hallazgo" is a panel at the bottom, fields are above.

        # Select TABLETA
        # Iterate selects to find the one with TABLETA
        selects = page.locator("select").all()
        for s in selects:
            txt = s.text_content()
            if "TABLETA" in txt:
                s.select_option("TABLETA")
                break

        page.wait_for_timeout(1000)

        # Check visibility
        content = page.content()
        if "Volumen Total" not in content:
            print("✅ 'Volumen Total' is HIDDEN for Discrete mode.")
        else:
            print("❌ 'Volumen Total' is VISIBLE for Discrete mode.")

        # Case B: Volumetric (Jarabe)
        print("Case B: Volumetric (Jarabe)...")
        for s in selects:
            txt = s.text_content()
            if "JARABE" in txt:
                s.select_option("JARABE")
                break

        # Need to set Presentation manually to trigger parser (since we aren't using CUM)
        # Find Presentation input.
        # It's one of the text inputs.
        # Placeholder "Digite..." or similar?
        # renderField for 'presentation' uses placeholder from config?
        # PRODUCT_SCHEMAS['MEDICAMENTO'] fields... 'presentation' usually has label "Presentación Comercial"
        # Since I can't see schema, I'll try to find input by label.

        # page.get_by_label("Presentación Comercial").fill("FRASCO X 120 ML")
        # But get_by_label requires 'for' attribute or wrapping.
        # My code: <label>...</label><input> (siblings)
        # Use locator with label text
        page.locator("div").filter(has_text="Presentación Comercial").last.locator("input").fill("FRASCO X 120 ML")

        page.wait_for_timeout(1000)

        content = page.content()
        # Note: Volume only shows if contentNet > 0. "FRASCO X 120 ML" parses to 120 mL.
        if "Volumen Total" in content:
            print("✅ 'Volumen Total' is VISIBLE for Volumetric mode.")
        else:
            print("❌ 'Volumen Total' is HIDDEN for Volumetric mode.")

        # 4. Generate PDF Preview
        print("Testing PDF Preview...")

        # Confirm Hallazgo
        page.get_by_role("button", name="CONFIRMAR HALLAZGO").click()

        # Handle Evidence Modal
        page.wait_for_timeout(1000)
        if page.get_by_text("Requerimiento Legal").is_visible():
            page.get_by_role("button", name="Omitir").click()

        # Go to Cierre
        page.get_by_role("button", name="Finalizar Inventario").click()
        page.wait_for_timeout(1000)

        # Fill Narrative
        page.locator("textarea").first.fill("Narrativa de prueba.")

        # Click Preview
        page.get_by_role("button", name="VISTA PREVIA Y FINALIZAR").click()

        # Take Screenshot
        page.wait_for_timeout(3000)
        page.screenshot(path="verification.png")
        print("Screenshot saved to verification.png")

        if page.get_by_text("Vista Previa del Acta").is_visible():
            print("✅ PDF Preview Modal is visible.")
        else:
            print("❌ PDF Preview Modal did NOT appear.")

        browser.close()

if __name__ == "__main__":
    verify_ux_logic()
