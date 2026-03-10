CREATE TABLE medicines (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  quantity INT NOT NULL,
  expiry_date DATE NOT NULL
);
