DROP TABLE IF EXISTS Users;
CREATE TABLE Users (id TEXT PRIMARY KEY, 
                    key TEXT UNIQUE, 
                    encryptedTOTPSecret TEXT, 
                    attempts INTEGER, 
                    disabled INTEGER, 
                    admin INTEGER, 
                    encrypted TEXT,
                    loginToken TEXT); 

DROP TABLE IF EXISTS Sessions;
CREATE TABLE Sessions (id TEXT PRIMARY KEY,
                       userID_FK TEXT, 
                       expires NUMBER,
                       deleted NUMBER);