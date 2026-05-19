from process_ad_images import main_resize

items = main_resize()
big = sum(1 for x in items if not x["ok"])
print(f"\nTOTAL: {len(items)} resized, {big} over 500KB limit")
