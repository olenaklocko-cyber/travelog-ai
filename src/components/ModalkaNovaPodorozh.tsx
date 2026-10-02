import { useState } from "react";
import { Button, Form, Input, InputNumber, Modal, Select, Space } from "antd";
import { krajiny, krajinyVyboru, statusy } from "../data/krajiny";
import type { NovaPodorozhForm } from "../types";
import "./ModalkaNovaPodorozh.css";

interface ModalkaNovaPodorozhProps {
  vidkryto: boolean;
  zakryty: () => void;
  /** Створити подорож. Повертає true, якщо все вдалося. */
  dobavyty: (znachennya: NovaPodorozhForm) => Promise<boolean>;
}

/** Модальне вікно «🧳 Нова подорож»: форма, перевірки, стан надсилання. */
export default function ModalkaNovaPodorozh({
  vidkryto,
  zakryty,
  dobavyty,
}: ModalkaNovaPodorozhProps) {
  const [daye, setDaye] = useState(false);
  const [forma] = Form.useForm();

  const zakrytyIZachystyty = () => {
    zakryty();
    forma.resetFields();
  };

  const nadislaty = async (znachennya: NovaPodorozhForm) => {
    setDaye(true);
    const ok = await dobavyty(znachennya);
    setDaye(false);
    if (ok) zakrytyIZachystyty();
  };

  return (
    <Modal
      title="🧳 Нова подорож"
      open={vidkryto}
      onCancel={zakrytyIZachystyty}
      footer={null}
      destroyOnHidden
    >
      <Form
        form={forma}
        layout="vertical"
        onFinish={nadislaty}
        initialValues={{ country_code: "IT", status: "Активні збори" }}
      >
        <Form.Item
          name="title"
          label="Назва або місто"
          rules={[{ required: true, message: "Вкажіть назву або місто" }]}
        >
          <Input placeholder="Наприклад: Рим" maxLength={60} />
        </Form.Item>

        <Form.Item
          name="country_code"
          label="Країна"
          rules={[{ required: true, message: "Оберіть країну" }]}
        >
          <Select
            options={krajinyVyboru.map((code) => ({
              value: code,
              label: `${krajiny[code].prapor} ${krajiny[code].nazva}`,
            }))}
          />
        </Form.Item>

        <Form.Item
          name="budget"
          label="Бюджет збору"
          rules={[{ required: true, message: "Вкажіть бюджет" }]}
        >
          <InputNumber
            min={1}
            max={100000000}
            style={{ width: "100%" }}
            addonAfter="грн"
            placeholder="Наприклад: 40000"
          />
        </Form.Item>

        <Form.Item name="status" label="Статус">
          <Select options={statusy.map((s) => ({ value: s, label: s }))} />
        </Form.Item>

        <Space className="modalka-knopy">
          <Button onClick={zakrytyIZachystyty}>Скасувати</Button>
          <Button type="primary" htmlType="submit" loading={daye}>
            Додати
          </Button>
        </Space>
      </Form>
    </Modal>
  );
}
