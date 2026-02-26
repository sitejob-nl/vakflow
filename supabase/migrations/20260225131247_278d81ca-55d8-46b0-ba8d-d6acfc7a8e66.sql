
-- 1) Notify on incoming WhatsApp message
CREATE OR REPLACE FUNCTION public.notify_on_whatsapp_incoming()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id uuid;
  cust_name text;
BEGIN
  IF NEW.direction <> 'incoming' THEN
    RETURN NEW;
  END IF;

  -- Look up customer name
  SELECT name INTO cust_name FROM public.customers WHERE id = NEW.customer_id;

  FOR admin_id IN
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, title, body, link_page, link_params)
    VALUES (
      admin_id,
      'Nieuw WhatsApp bericht',
      COALESCE(cust_name, 'Onbekend') || ': ' || LEFT(COALESCE(NEW.content, '[media]'), 100),
      'whatsapp',
      '{}'::jsonb
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_whatsapp_incoming
  AFTER INSERT ON public.whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_whatsapp_incoming();

-- 2) Notify on work order status change
CREATE OR REPLACE FUNCTION public.notify_on_work_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id uuid;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  FOR admin_id IN
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, title, body, link_page, link_params)
    VALUES (
      admin_id,
      'Werkbon status gewijzigd',
      COALESCE(NEW.work_order_number, 'Werkbon') || ' → ' || NEW.status,
      'woDetail',
      jsonb_build_object('workOrderId', NEW.id::text)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_work_order_status
  AFTER UPDATE ON public.work_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_work_order_status();

-- 3) Notify on invoice paid
CREATE OR REPLACE FUNCTION public.notify_on_invoice_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id uuid;
BEGIN
  IF OLD.status = 'betaald' OR NEW.status <> 'betaald' THEN
    RETURN NEW;
  END IF;

  FOR admin_id IN
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, title, body, link_page, link_params)
    VALUES (
      admin_id,
      'Factuur betaald',
      COALESCE(NEW.invoice_number, 'Factuur') || ' — €' || NEW.total::text,
      'invoices',
      '{}'::jsonb
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_invoice_paid
  AFTER UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_invoice_paid();
