-- スライスRSV-C: rooms / reservations (design.md データモデル)
-- ダブルブッキングの最終防衛はEXCLUDE制約(室×時間範囲の重なり禁止)。
-- 半開区間[start, end)なので、前の予約の終了と同時刻の開始は重なりにならない(RSV-C-03)。

-- EXCLUDE制約でroom_idの等値比較(=)をGiSTで使うために必要
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE rooms (
    id                   VARCHAR(64)  PRIMARY KEY,
    name                 VARCHAR(255) NOT NULL UNIQUE,
    business_hours_start TIME         NOT NULL,
    business_hours_end   TIME         NOT NULL,
    capacity             INT          NOT NULL
);

CREATE TABLE reservations (
    id                   UUID         PRIMARY KEY,
    room_id              VARCHAR(64)  NOT NULL,
    reserver_id          VARCHAR(64)  NOT NULL,
    "date"               DATE         NOT NULL,
    start_time           TIME         NOT NULL,
    end_time             TIME         NOT NULL,
    attendee_count       INT          NOT NULL,
    business_hours_start TIME         NOT NULL,
    business_hours_end   TIME         NOT NULL,
    capacity_snapshot    INT          NOT NULL,
    cancelled_at         TIMESTAMP    NULL,
    version              BIGINT       NOT NULL,
    -- 室×時間帯の排他的占有(RSV-C-02)。キャンセル済みは対象外(部分排他制約: ワークADR-0008)
    CONSTRAINT reservations_no_overlap EXCLUDE USING gist (
        room_id WITH =,
        tsrange("date" + start_time, "date" + end_time, '[)') WITH &&
    ) WHERE (cancelled_at IS NULL)
);
