-- Preserve human notes when Stripe automatically closes a paid invoice task.
-- The machine reason belongs in the task audit event, not the human decision note.
-- No action flags, workflow configuration or provider sends change.
CREATE OR REPLACE FUNCTION public.ops_sync_payment_case_task(p_case uuid) RETURNS uuid LANGUAGE plpgsql SET search_path=public AS $$
DECLARE c ops_payment_cases;t ops_tasks; label text; detail text;
BEGIN
 SELECT * INTO c FROM ops_payment_cases WHERE id=p_case FOR UPDATE;
 IF c.state='paid' THEN
  IF c.task_id IS NOT NULL AND EXISTS(SELECT 1 FROM ops_tasks WHERE id=c.task_id AND status NOT IN ('done','cancelled')) THEN
   PERFORM ops_mutate_task('complete',jsonb_build_object('status','done','completion_reason','Stripe confirms this invoice is paid; this invoice follow-up is closed.'),'stripe-payment',c.task_id);
  END IF;
  RETURN c.task_id;
 END IF;
 label=coalesce(nullif(c.customer_name,''),nullif(c.contact_email,''),c.invoice_id);
 detail='Invoice '||c.invoice_id||' · '||c.stripe_account_id||E'\nPayment: '||c.state||E'\nWhatsApp: '||coalesce(c.latest_delivery,'not sent')||E'\nVerified reminders: '||c.reminder_count;
 IF c.reminder_count>=2 THEN detail=detail||E'\nBoth agreed WhatsApp reminders have verified sent/delivered receipts. Eimear needs to follow up personally; automatic reminders have ended.'; END IF;
 IF c.reply_needs_human OR c.manual_pause OR c.contact_dnd THEN detail=detail||E'\nAutomatic follow-up stopped; Eimear needs to review this case.';
 ELSIF c.contact_id IS NULL OR NOT c.whatsapp_opt_in THEN detail=detail||E'\nVerify the CRM contact and WhatsApp permission before any reminder.'; END IF;
 t=ops_mutate_task('create',jsonb_build_object('kind','flag','area','payments','title',CASE WHEN c.reminder_count>=2 THEN 'Eimear: follow up on unpaid payment — ' ELSE 'Payment needs checking — ' END||label,'detail',detail,'assignee','eimear','external_ref','payment-case:'||c.id,'payload',jsonb_build_object('payment_case_id',c.id,'stripe_account_id',c.stripe_account_id,'invoice_id',c.invoice_id,'state',c.state,'latest_delivery',c.latest_delivery),'links',jsonb_build_array(jsonb_build_object('label','Review payment case','url','/admin/automation?payment='||c.id))),'payment-case');
 IF c.reminder_count>=2 AND t.assignee<>'eimear' THEN t=ops_mutate_task('update',jsonb_build_object('assignee','eimear'),'payment-handoff',t.id); END IF;
 IF t.status IN ('done','cancelled','rejected') THEN t=ops_mutate_task('update',jsonb_build_object('status','open'),'payment-case',t.id); END IF;
 UPDATE ops_payment_cases SET task_id=t.id WHERE id=c.id;
 RETURN t.id;
END $$;

-- Replacing this service-only function retains its existing ACLs.
