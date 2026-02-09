from playwright.sync_api import sync_playwright

def seed_and_verify():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Grant geolocation
        context = browser.new_context(permissions=["geolocation"], geolocation={"latitude": 4.6, "longitude": -74.0})
        page = context.new_page()

        print("1. Creating Establishment via Census...")
        page.goto("http://localhost:5173/dashboard/census/new")
        page.wait_for_timeout(2000)

        # Fill Census Form (Basic Fields)
        # I need to guess the inputs based on common field names/labels if I can't see the code for CensusForm.
        # But I can check the input types.

        # Trying generic fills
        # Name
        page.locator("input[type='text']").first.fill("DROGUERIA DE PRUEBA")
        # NIT
        page.locator("input").nth(1).fill("900123456")
        # Address
        page.locator("input").nth(2).fill("CALLE 123 # 45-67")
        # Email
        page.locator("input[type='email']").fill("test@vigisalud.com")

        # Coordinates (if requested) - usually auto-filled or manual button.
        # Assuming manual input or skip.

        # Save Button
        # Look for "Guardar", "Registrar", "Crear"
        page.get_by_role("button", name="Guardar").click()
        page.wait_for_timeout(2000)

        print("Establishment Created (Hopefully). Navigating to Inspection...")

        # 2. Go to Inspection Wizard
        # ID is likely 1 since it's the first one.
        page.goto("http://localhost:5173/dashboard/inspections/new/1")
        page.wait_for_timeout(3000)

        # Check if we passed the "Cargando..." screen
        if "Validación de Territorio" in page.content():
            print("✅ Wizard Step 1 Loaded!")

            # WIZARD FLOW (GPS)
            if page.get_by_role("button", name="Justificar Excepción").is_visible():
                page.get_by_role("button", name="Justificar Excepción").click()
                page.wait_for_timeout(500)
                page.get_by_role("button", name="Asumo Responsabilidad").click()
            elif page.get_by_role("button", name="Validación Exitosa").is_visible():
                page.get_by_role("button", name="Validación Exitosa").click()

            page.wait_for_timeout(1000)

            # WIZARD FLOW (Motive)
            if "Protocolo de Apertura" in page.content():
                print("✅ Wizard Step 2 Loaded!")
                # Fill Attendant
                page.get_by_role("button", name="Otra Persona / Encargado").click()
                page.get_by_placeholder("BUSCAR O ESCRIBIR...").fill("JUAN PEREZ")
                page.get_by_placeholder("Ej: 1.140...").fill("12345678")
                page.get_by_placeholder("Ej: EMPLEADO").fill("ENCARGADO")

                page.get_by_role("button", name="Iniciar Diligencia").click()
                page.wait_for_timeout(1000)

                # FORM VERIFICATION
                if "Continuar a Inventario" in page.content():
                    print("✅ Entered Inspection Form!")

                    # Go to Products
                    page.get_by_role("button", name="Continuar a Inventario").click()

                    # Test Hallazgo UI
                    page.get_by_role("button", name="REPORTAR HALLAZGO").click()
                    page.wait_for_timeout(500)

                    if page.get_by_text("Causales del Riesgo").is_visible():
                        print("✅ Hallazgo Panel Visible.")
                        # Check Chips
                        if page.get_by_role("button", name="VENCIDO").is_visible():
                             print("✅ Chip 'VENCIDO' confirmed.")

                        # Take Final Verification Screenshot
                        page.screenshot(path="final_verification.png")
                        print("Screenshot saved.")
                    else:
                        print("❌ Hallazgo Panel NOT visible.")
                else:
                    print("❌ Failed to enter form.")
            else:
                print("❌ Stuck at Step 1/2.")
        else:
            print("❌ Still stuck at 'Cargando expediente...' or 404.")
            page.screenshot(path="fail_seed.png")

        browser.close()

if __name__ == "__main__":
    seed_and_verify()
