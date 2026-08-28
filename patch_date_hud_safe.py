from pathlib import Path

p = Path("src/main.cpp")
text = p.read_text(encoding="utf-8")

marker = '''    gfx.print(currentTimeText);
'''

date_code = '''    gfx.print(currentTimeText);

    // DATE: YY.MM.DD
    struct tm hudDateInfo;
    char hudDateText[9] = "--.--.--";

    if (
        timeSynced &&
        getLocalTime(
            &hudDateInfo,
            20
        )
    )
    {
        snprintf(
            hudDateText,
            sizeof(hudDateText),
            "%02d.%02d.%02d",
            (hudDateInfo.tm_year + 1900) % 100,
            hudDateInfo.tm_mon + 1,
            hudDateInfo.tm_mday
        );
    }

    gfx.setTextSize(1);

    gfx.setTextColor(
        gfx.color565(
            190,
            179,
            207
        )
    );

    int hudDateWidth =
        gfx.textWidth(
            hudDateText
        );

    gfx.setCursor(
        273 - (hudDateWidth / 2),
        26
    );

    gfx.print(
        hudDateText
    );
'''

if "hudDateText" in text:
    print("DATE HUD ALREADY EXISTS - NO CHANGE")
elif marker not in text:
    print("ERROR: clock display marker not found")
else:
    text = text.replace(
        marker,
        date_code,
        1
    )

    p.write_text(
        text,
        encoding="utf-8",
        newline="\n"
    )

    print("DATE HUD ADDED -> YY.MM.DD")
