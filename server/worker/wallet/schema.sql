DROP TABLE IF EXISTS Wallets;
CREATE TABLE Wallets (id TEXT PRIMARY KEY, 
                     tokens INTEGER, 
                     activationValue INTEGER, 
                     activationCode TEXT UNIQUE,
                     activationExpiration INTEGER, 
                     onActivationTransferToWalletID TEXT, 
                     active INTEGER,
                     created INTEGER, 
                     deleted INTEGER);

CREATE INDEX idx_activationCode ON Wallets(activationCode);
CREATE INDEX idx_deleted ON Wallets(deleted);

DROP TABLE IF EXISTS ExchangeRate;
CREATE TABLE ExchangeRate (auto_id INTEGER PRIMARY KEY AUTOINCREMENT, 
                           rate REAL);

INSERT INTO ExchangeRate (rate)
SELECT 100.0 WHERE NOT EXISTS (SELECT 1 FROM ExchangeRate);

DROP TABLE IF EXISTS Transactions;
CREATE TABLE Transactions (auto_id INTEGER PRIMARY KEY AUTOINCREMENT, 
                           fromWalletID TEXT,
                           toWalletID TEXT,
                           tokens INTEGER,
                           value REAL,
                           epoch INTEGER);