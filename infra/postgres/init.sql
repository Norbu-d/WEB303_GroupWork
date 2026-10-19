-- One database + one login role per service. Nobody else can connect to it,
-- so a service physically cannot read another service's data.
CREATE ROLE menu_user         LOGIN PASSWORD 'menu_pass';
CREATE ROLE order_user        LOGIN PASSWORD 'order_pass';
CREATE ROLE kitchen_user      LOGIN PASSWORD 'kitchen_pass';
CREATE ROLE inventory_user    LOGIN PASSWORD 'inventory_pass';
CREATE ROLE notification_user LOGIN PASSWORD 'notification_pass';

CREATE DATABASE menu_db         OWNER menu_user;
CREATE DATABASE order_db        OWNER order_user;
CREATE DATABASE kitchen_db      OWNER kitchen_user;
CREATE DATABASE inventory_db    OWNER inventory_user;
CREATE DATABASE notification_db OWNER notification_user;

REVOKE CONNECT ON DATABASE menu_db         FROM PUBLIC;
REVOKE CONNECT ON DATABASE order_db        FROM PUBLIC;
REVOKE CONNECT ON DATABASE kitchen_db      FROM PUBLIC;
REVOKE CONNECT ON DATABASE inventory_db    FROM PUBLIC;
REVOKE CONNECT ON DATABASE notification_db FROM PUBLIC;
